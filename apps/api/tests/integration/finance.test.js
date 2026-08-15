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

describe('Finance Endpoints', () => {
    let clientOwnerToken;
    let freelancerOwnerToken;
    let outsiderToken;
    let nonOwnerTokenConfig;
    let clientWorkspace, freelancerWorkspace;
    let activeAgreementId;
    let milestoneId;

    beforeEach(async () => {
        clientOwnerToken = await registerAndLogin('finance-co@test.com', 'CLIENT');
        freelancerOwnerToken = await registerAndLogin('finance-fo@test.com', 'FREELANCER');
        outsiderToken = await registerAndLogin('finance-out@test.com', 'CLIENT');
        const nonOwnerToken = await registerAndLogin('finance-non@test.com', 'CLIENT');

        const cws = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({ name: 'Finance Client WS' });
        clientWorkspace = cws.body.data.workspace;

        await request(app)
            .post(`/api/v1/workspaces/${clientWorkspace._id}/members`)
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({ email: 'finance-non@test.com' });

        nonOwnerTokenConfig = nonOwnerToken;

        const fws = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${freelancerOwnerToken}`)
            .send({ name: 'Finance Freelancer WS' });
        freelancerWorkspace = fws.body.data.workspace;

        const agRes = await request(app)
            .post('/api/v1/agreements')
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({
                clientWorkspaceId: clientWorkspace._id,
                freelancerWorkspaceId: freelancerWorkspace._id,
                title: 'Finance Test Agreement',
                scope: 'Finance Test Scope',
                currency: 'USD',
                contractAmountMinor: 1000000,
                startDate: '2026-09-01',
                endDate: '2026-12-01',
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
                title: 'Finance Milestone',
                amountMinor: 200000,
                sequence: 1,
                dueDate: '2026-10-01',
            });
        milestoneId = msRes.body.data._id;
    });

    describe('Wallet Top-Up', () => {
        it('should allow CLIENT owner to perform a simulated top-up', async () => {
            const key = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 500000 });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.wallet.availableAmountMinor).toBe(500000);
            expect(res.body.meta.requestId).toBeDefined();
        });

        it('should reject top-up by non-owner', async () => {
            const key = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${outsiderToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 500000 });

            expect(res.status).toBe(404);
        });

        it('should reject top-up by freelancer workspace owner', async () => {
            const key = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/wallets/${freelancerWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${freelancerOwnerToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 500000 });

            expect(res.status).toBe(403);
        });

        it('should reject top-up by active non-owner member', async () => {
            const key = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${nonOwnerTokenConfig}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 500000 });

            expect(res.status).toBe(403);
        });

        it('should produce one credit and net wallet increase on concurrent identical top-ups', async () => {
            const key = crypto.randomUUID();

            const results = await Promise.all([
                request(app)
                    .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                    .set('Authorization', `Bearer ${clientOwnerToken}`)
                    .set('Idempotency-Key', key)
                    .send({ currency: 'USD', amountMinor: 500000 }),
                request(app)
                    .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                    .set('Authorization', `Bearer ${clientOwnerToken}`)
                    .set('Idempotency-Key', key)
                    .send({ currency: 'USD', amountMinor: 500000 }),
            ]);

            const successes = results.filter((r) => r.status === 201 || r.status === 200);
            expect(successes.length).toBe(2);

            const walletRes = await request(app)
                .get(`/api/v1/finance/wallets/${clientWorkspace._id}?currency=USD`)
                .set('Authorization', `Bearer ${clientOwnerToken}`);
            expect(walletRes.body.data.availableAmountMinor).toBe(500000);

            const LedgerEntry = mongoose.model('LedgerEntry');
            const entries = await LedgerEntry.find({ idempotencyKey: key }).lean();
            expect(entries.length).toBe(1);
        });

        it('should return HTTP 400 when idempotency key is missing', async () => {
            const res = await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .send({ currency: 'USD', amountMinor: 500000 });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
        });

        it('should not increase balance when repeating the same top-up key', async () => {
            const key = crypto.randomUUID();

            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 500000 });

            const res = await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 500000 });

            expect(res.status).toBe(200);
            expect(res.body.data.wallet.availableAmountMinor).toBe(500000);
        });

        it('should return HTTP 409 when reusing key with different amount', async () => {
            const key = crypto.randomUUID();

            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 500000 });

            const res = await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 300000 });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
        });

        it('should return HTTP 409 when reusing key with different currency', async () => {
            const key = crypto.randomUUID();

            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 500000 });

            const res = await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'EUR', amountMinor: 500000 });

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
        });
    });

    describe('Get Wallet', () => {
        it('should return zero-balance wallet for unfunded currency', async () => {
            const res = await request(app)
                .get(`/api/v1/finance/wallets/${clientWorkspace._id}?currency=USD`)
                .set('Authorization', `Bearer ${clientOwnerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.availableAmountMinor).toBe(0);
            expect(res.body.data.escrowedAmountMinor).toBe(0);
            expect(res.body.meta.requestId).toBeDefined();
        });

        it('should return actual balance after top-up', async () => {
            const key = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', key)
                .send({ currency: 'USD', amountMinor: 500000 });

            const res = await request(app)
                .get(`/api/v1/finance/wallets/${clientWorkspace._id}?currency=USD`)
                .set('Authorization', `Bearer ${clientOwnerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.availableAmountMinor).toBe(500000);
        });

        it('should reject wallet read by outsider', async () => {
            const res = await request(app)
                .get(`/api/v1/finance/wallets/${clientWorkspace._id}?currency=USD`)
                .set('Authorization', `Bearer ${outsiderToken}`);

            expect(res.status).toBe(404);
        });

        it('should reject wallet read by active non-owner', async () => {
            const res = await request(app)
                .get(`/api/v1/finance/wallets/${clientWorkspace._id}?currency=USD`)
                .set('Authorization', `Bearer ${nonOwnerTokenConfig}`);

            expect(res.status).toBe(403);
        });
    });

    describe('Fund Milestone', () => {
        it('should fund a DRAFT milestone and change it to FUNDED', async () => {
            const topUpKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey)
                .send({ currency: 'USD', amountMinor: 500000 });

            const fundKey = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            expect(res.status).toBe(201);
            expect(res.body.data.milestone.status).toBe('FUNDED');
            expect(res.body.meta.requestId).toBeDefined();
        });

        it('should decrease available and increase escrowed by amountMinor', async () => {
            const topUpKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey)
                .send({ currency: 'USD', amountMinor: 500000 });

            const fundKey = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            expect(res.status).toBe(201);
            expect(res.body.data.wallet.availableAmountMinor).toBe(300000);
            expect(res.body.data.wallet.escrowedAmountMinor).toBe(200000);
        });

        it('should create exactly two ledger entries with one shared operationId', async () => {
            const topUpKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey)
                .send({ currency: 'USD', amountMinor: 500000 });

            const fundKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            const LedgerEntry = mongoose.model('LedgerEntry');
            const entries = await LedgerEntry.find({
                milestoneId,
                operationType: 'MILESTONE_FUND',
            }).lean();

            expect(entries.length).toBe(2);

            const sides = entries.map((e) => e.entrySide).sort();
            expect(sides).toEqual(['AVAILABLE_DEBIT', 'ESCROW_CREDIT']);

            expect(entries[0].operationId).toBe(entries[1].operationId);
        });

        it('should not double-debit when repeating the same funding key', async () => {
            const topUpKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey)
                .send({ currency: 'USD', amountMinor: 500000 });

            const fundKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            expect(res.status).toBe(200);

            const walletRes = await request(app)
                .get(`/api/v1/finance/wallets/${clientWorkspace._id}?currency=USD`)
                .set('Authorization', `Bearer ${clientOwnerToken}`);

            expect(walletRes.body.data.availableAmountMinor).toBe(300000);
            expect(walletRes.body.data.escrowedAmountMinor).toBe(200000);

            const LedgerEntry = mongoose.model('LedgerEntry');
            const entries = await LedgerEntry.find({
                milestoneId,
                operationType: 'MILESTONE_FUND',
            }).lean();
            expect(entries.length).toBe(2);
        });

        it('should leave everything unchanged when insufficient funds', async () => {
            const fundKey = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');

            const walletRes = await request(app)
                .get(`/api/v1/finance/wallets/${clientWorkspace._id}?currency=USD`)
                .set('Authorization', `Bearer ${clientOwnerToken}`);
            expect(walletRes.body.data.availableAmountMinor).toBe(0);
            expect(walletRes.body.data.escrowedAmountMinor).toBe(0);

            const msRes = await request(app)
                .get(`/api/v1/milestones/${milestoneId}`)
                .set('Authorization', `Bearer ${clientOwnerToken}`);
            expect(msRes.body.data.status).toBe('DRAFT');

            const LedgerEntry = mongoose.model('LedgerEntry');
            const entries = await LedgerEntry.find({
                milestoneId,
                operationType: 'MILESTONE_FUND',
            }).lean();
            expect(entries.length).toBe(0);
        });

        it('should reject funding by freelancer', async () => {
            const fundKey = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${freelancerOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            expect(res.status).toBe(403);
        });

        it('should reject funding by outsider', async () => {
            const fundKey = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${outsiderToken}`)
                .set('Idempotency-Key', fundKey);

            expect(res.status).toBe(404);
        });

        it('should return 400 Validation Error when passing unknown fields to endpoints', async () => {
            const fundKey = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey)
                .send({ unknownExtraField: true }); // Should cause strict check fail

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject funding a non-DRAFT milestone', async () => {
            const topUpKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey)
                .send({ currency: 'USD', amountMinor: 500000 });

            const fundKey1 = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey1);

            const fundKey2 = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey2);

            expect(res.status).toBe(409);
        });

        it('should use VouchWire success envelope with meta.requestId', async () => {
            const topUpKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey)
                .send({ currency: 'USD', amountMinor: 500000 });

            const fundKey = crypto.randomUUID();
            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();
            expect(res.body.meta).toBeDefined();
            expect(res.body.meta.requestId).toBeDefined();
        });

        it('should return deterministic snapshot unaffected by later top-ups', async () => {
            const topUpKey1 = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey1)
                .send({ currency: 'USD', amountMinor: 100000 });

            const topUpKey2 = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey2)
                .send({ currency: 'USD', amountMinor: 300000 });

            const replayRes = await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey1)
                .send({ currency: 'USD', amountMinor: 100000 });

            expect(replayRes.status).toBe(200);
            expect(replayRes.body.data.wallet.availableAmountMinor).toBe(100000);
        });

        it('should successfully enforce concurrent funding bounds with different keys', async () => {
            const topUpKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey)
                .send({ currency: 'USD', amountMinor: 800000 });

            const fundKey1 = crypto.randomUUID();
            const fundKey2 = crypto.randomUUID();

            const results = await Promise.all([
                request(app)
                    .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                    .set('Authorization', `Bearer ${clientOwnerToken}`)
                    .set('Idempotency-Key', fundKey1),
                request(app)
                    .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                    .set('Authorization', `Bearer ${clientOwnerToken}`)
                    .set('Idempotency-Key', fundKey2),
            ]);

            const codes = results.map((r) => r.status).sort();
            expect(codes).toEqual([201, 409]);

            const LedgerEntry = mongoose.model('LedgerEntry');
            const entries = await LedgerEntry.find({
                milestoneId,
                operationType: 'MILESTONE_FUND',
            }).lean();
            expect(entries.length).toBe(2);
        });

        it('should safely return 200 OK for concurrent milestone funding operations with the same idempotency key', async () => {
            const topUpKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey)
                .send({ currency: 'USD', amountMinor: 800000 });

            // Using identical fund keys to test idempotency race condition block inside escrow-funding service
            const duplicateFundKey = crypto.randomUUID();

            const results = await Promise.all([
                request(app)
                    .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                    .set('Authorization', `Bearer ${clientOwnerToken}`)
                    .set('Idempotency-Key', duplicateFundKey),
                request(app)
                    .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                    .set('Authorization', `Bearer ${clientOwnerToken}`)
                    .set('Idempotency-Key', duplicateFundKey),
            ]);

            const codes = results.map((r) => r.status).sort();
            expect(codes).toEqual([200, 201]);
        });

        it('should return 409 IDEMPOTENCY_KEY_REUSED when key applies to a different milestone', async () => {
            const topUpKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/wallets/${clientWorkspace._id}/top-ups`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', topUpKey)
                .send({ currency: 'USD', amountMinor: 500000 });

            const msRes2 = await request(app)
                .post(`/api/v1/milestones/agreements/${activeAgreementId}`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .send({
                    title: 'Second Milestone',
                    amountMinor: 100000,
                    sequence: 2,
                    dueDate: '2026-11-01',
                });
            const milestoneId2 = msRes2.body.data._id;

            const fundKey = crypto.randomUUID();
            await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            const res = await request(app)
                .post(`/api/v1/finance/milestones/${milestoneId2}/fund`)
                .set('Authorization', `Bearer ${clientOwnerToken}`)
                .set('Idempotency-Key', fundKey);

            expect(res.status).toBe(409);
        });
    });
});
