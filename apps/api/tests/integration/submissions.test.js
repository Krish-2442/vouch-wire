import request from 'supertest';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { describe, it, expect, beforeEach } from 'vitest';
import createApp from '../../src/app.js';
import { setupTestDatabase } from '../helpers/database-lifecycle.helper.js';

const app = createApp();
setupTestDatabase();

const registerAndLogin = async (email, role) => {
    await request(app).post('/api/v1/auth/register').send({
        fullName: 'Test User',
        email,
        password: 'password123456',
        role,
    });
    const loginRes = await request(app).post('/api/v1/auth/login').send({
        email,
        password: 'password123456',
    });
    return loginRes.body.data.accessToken;
};

describe('Submissions and Approve-and-Release Endpoints', () => {
    let clientOwnerToken, freelancerOwnerToken, outsiderToken;
    let clientWorkspace, freelancerWorkspace;
    let activeAgreementId, milestoneId;

    beforeEach(async () => {
        clientOwnerToken = await registerAndLogin('sub-client@test.com', 'CLIENT');
        freelancerOwnerToken = await registerAndLogin('sub-free@test.com', 'FREELANCER');
        outsiderToken = await registerAndLogin('sub-out@test.com', 'CLIENT');

        const cws = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({ name: 'Sub Client WS' });
        clientWorkspace = cws.body.data.workspace;

        const fws = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${freelancerOwnerToken}`)
            .send({ name: 'Sub Freelancer WS' });
        freelancerWorkspace = fws.body.data.workspace;

        const agRes = await request(app)
            .post('/api/v1/agreements')
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({
                clientWorkspaceId: clientWorkspace._id,
                freelancerWorkspaceId: freelancerWorkspace._id,
                title: 'Submission Test Agreement',
                scope: 'Valid test scope content',
                currency: 'USD',
                contractAmountMinor: 1000000,
                startDate: new Date(Date.now() + 86400000).toISOString(),
                endDate: new Date(Date.now() + 172800000).toISOString(),
            });

        activeAgreementId = agRes.body.data._id;

        await request(app)
            .post(`/api/v1/agreements/${activeAgreementId}/propose`)
            .set('Authorization', `Bearer ${clientOwnerToken}`);

        await request(app)
            .post(`/api/v1/agreements/${activeAgreementId}/accept`)
            .set('Authorization', `Bearer ${freelancerOwnerToken}`);

        const msRes = await request(app)
            .post(`/api/v1/milestones/agreements/${activeAgreementId}`)
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({
                title: 'Sub Milestone',
                amountMinor: 200000,
                sequence: 1,
                dueDate: new Date(Date.now() + 129600000).toISOString(),
            });
        milestoneId = msRes.body.data._id;
    });

    const fundMilestone = async () => {
        await request(app)
            .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .set('Idempotency-Key', crypto.randomUUID())
            .send({ currency: 'USD', amountMinor: 500000 });

        await request(app)
            .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .set('Idempotency-Key', crypto.randomUUID());
    };

    describe('Work Submission', () => {
        it('Submission against a DRAFT milestone fails with HTTP 409', async () => {
            const res = await request(app)
                .post(`/api/v1/submissions/milestones/${milestoneId}`)
                .set('Authorization', `Bearer ${freelancerOwnerToken}`)
                .send({ summary: 'Attempting to submit early' });

            expect(res.status).toBe(409);
        });

        it('Freelancer workspace member can submit a FUNDED milestone', async () => {
            await fundMilestone();

            const res = await request(app)
                .post(`/api/v1/submissions/milestones/${milestoneId}`)
                .set('Authorization', `Bearer ${freelancerOwnerToken}`)
                .send({ summary: 'Completed unit test suite.' });

            expect(res.status).toBe(201);
            expect(res.body.data.summary).toBe('Completed unit test suite.');
        });

        it('Submission changes milestone status from FUNDED to SUBMITTED', async () => {
            await fundMilestone();

            await request(app)
                .post(`/api/v1/submissions/milestones/${milestoneId}`)
                .set('Authorization', `Bearer ${freelancerOwnerToken}`)
                .send({ summary: 'Submitted changes' });

            const msRes = await request(app)
                .get(`/api/v1/milestones/${milestoneId}`)
                .set('Authorization', `Bearer ${clientOwnerToken}`);

            expect(msRes.body.data.status).toBe('SUBMITTED');
        });

        it('Client user cannot submit on behalf of the freelancer', async () => {
            await fundMilestone();

            const res = await request(app)
                .post(`/api/v1/submissions/milestones/${milestoneId}`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .send({ summary: 'Imposter submission' });

            expect(res.status).toBe(403);
        });

        it('Outsider cannot read or submit for a milestone', async () => {
            await fundMilestone();

            const readRes = await request(app)
                .get(`/api/v1/submissions/milestones/${milestoneId}`)
                .set('Authorization', `Bearer ${outsiderToken}`);
            expect(readRes.status).toBe(404);

            const subRes = await request(app)
                .post(`/api/v1/submissions/milestones/${milestoneId}`)
                .set('Authorization', `Bearer ${outsiderToken}`)
                .send({ summary: 'Malicious attempt' });
            expect(subRes.status).toBe(404);
        });
    });

    describe('Approve and Release Escrow', () => {
        beforeEach(async () => {
            await fundMilestone();
            await request(app)
                .post(`/api/v1/submissions/milestones/${milestoneId}`)
                .set('Authorization', `Bearer ${freelancerOwnerToken}`)
                .send({ summary: 'Ready for review' });
        });

        it('Missing idempotency key returns HTTP 400', async () => {
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                .set('Authorization', `Bearer ${clientOwnerToken}`);
            expect(res.status).toBe(400);
        });

        it('Client workspace OWNER can approve and release a submitted milestone', async () => {
            const key = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key);

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.meta.requestId).toBeDefined();

            // Client escrow decreases by exactly amountMinor. Freelancer available balance increases by exactly amountMinor.
            expect(res.body.data.clientWallet.availableAmountMinor).toBe(300000); // 500k top up - 200k locked originally = 300k, remains 300k
            expect(res.body.data.clientWallet.escrowedAmountMinor).toBe(0); // 200k locked becomes 0
            expect(res.body.data.freelancerWallet.availableAmountMinor).toBe(200000); // gets 200k
        });

        it('Approval changes milestone status to APPROVED, records approvedBy and approvedAt', async () => {
            const key = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key);

            expect(res.body.data.milestone.status).toBe('APPROVED');
            expect(res.body.data.milestone.approvedBy).toBeDefined();
            expect(res.body.data.milestone.approvedAt).toBeDefined();
        });

        it('Exactly two ESCROW_RELEASE ledger entries exist and share an operationId', async () => {
            const key = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key);

            const LedgerEntry = mongoose.model('LedgerEntry');
            const entries = await LedgerEntry.find({
                milestoneId,
                operationType: 'ESCROW_RELEASE',
            }).lean();

            expect(entries.length).toBe(2);
            expect(entries[0].operationId).toBe(entries[1].operationId);
            const sides = entries.map((e) => e.entrySide).sort();
            expect(sides).toEqual(['AVAILABLE_CREDIT', 'ESCROW_DEBIT']);
        });

        it('A repeated approval with the same key returns HTTP 200 and does not move money again', async () => {
            const key = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key);

            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key);

            expect(res.status).toBe(200);
            expect(res.body.data.clientWallet.escrowedAmountMinor).toBe(0);

            const LedgerEntry = mongoose.model('LedgerEntry');
            const entries = await LedgerEntry.find({
                milestoneId,
                operationType: 'ESCROW_RELEASE',
            }).lean();
            expect(entries.length).toBe(2);
        });

        it('Two simultaneous approval requests using the same idempotency key result in one release and two ledger entries', async () => {
            const key = crypto.randomUUID();
            const results = await Promise.all([
                request(app)
                    .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                    .set('Authorization', `Bearer ${clientOwnerToken}`)
                    .set('Idempotency-Key', key),
                request(app)
                    .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                    .set('Authorization', `Bearer ${clientOwnerToken}`)
                    .set('Idempotency-Key', key),
            ]);

            const codes = results.map((r) => r.status).sort();
            expect(codes).toEqual([200, 201]);

            const LedgerEntry = mongoose.model('LedgerEntry');
            const entries = await LedgerEntry.find({
                milestoneId,
                operationType: 'ESCROW_RELEASE',
            }).lean();
            expect(entries.length).toBe(2);
        });

        it('A second approval attempt with a distinct key cannot release the already approved milestone', async () => {
            const key = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key);

            const key2 = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/approve-and-release`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key2);

            expect(res.status).toBe(409);

            const LedgerEntry = mongoose.model('LedgerEntry');
            const entries = await LedgerEntry.find({
                milestoneId,
                operationType: 'ESCROW_RELEASE',
            }).lean();
            expect(entries.length).toBe(2); // no extra duplicate entries
        });
    });
});
