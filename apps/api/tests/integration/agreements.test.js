import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
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

describe('Agreements Endpoints', () => {
    let clientToken;
    let freelancerToken;
    let outsiderToken;
    let clientWorkspace;
    let freelancerWorkspace;

    beforeEach(async () => {
        clientToken = await registerAndLogin('agree-client@test.com', 'CLIENT');
        freelancerToken = await registerAndLogin('agree-freelancer@test.com', 'FREELANCER');
        outsiderToken = await registerAndLogin('agree-outsider@test.com', 'CLIENT');

        const cws = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${clientToken}`)
            .send({ name: 'Acme Corp' });

        clientWorkspace = cws.body.data.workspace;

        const fws = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${freelancerToken}`)
            .send({ name: 'Jane Dev Studio' });

        freelancerWorkspace = fws.body.data.workspace;
    });

    const body = () => ({
        clientWorkspaceId: clientWorkspace._id,
        freelancerWorkspaceId: freelancerWorkspace._id,
        title: 'Web Development Contract',
        scope: 'Build a landing page with responsive design.',
        currency: 'USD',
        contractAmountMinor: 500000,
        startDate: '2026-09-01',
        endDate: '2026-12-01',
    });

    const createDraftAgreement = async () => {
        const res = await request(app)
            .post('/api/v1/agreements')
            .set('Authorization', `Bearer ${clientToken}`)
            .send(body());

        return res.body.data._id;
    };

    describe('POST /api/v1/agreements', () => {
        it('should create an agreement as DRAFT', async () => {
            const res = await request(app)
                .post('/api/v1/agreements')
                .set('Authorization', `Bearer ${clientToken}`)
                .send(body());

            expect(res.status).toBe(201);
            expect(res.body.data.status).toBe('DRAFT');
            expect(res.body.data.title).toBe('Web Development Contract');
            expect(res.body.data.clientWorkspaceId).toBe(clientWorkspace._id);
            expect(res.body.data.freelancerWorkspaceId).toBe(freelancerWorkspace._id);
        });

        it('should reject creation with identical workspace IDs', async () => {
            const res = await request(app)
                .post('/api/v1/agreements')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ ...body(), freelancerWorkspaceId: clientWorkspace._id });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('INVALID_AGREEMENT_PARTICIPANTS');
        });

        it('should reject creation by freelancer (not client-workspace owner)', async () => {
            const res = await request(app)
                .post('/api/v1/agreements')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send(body());

            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('AGREEMENT_ACCESS_DENIED');
        });

        it('should reject when client workspace type is FREELANCER', async () => {
            const res = await request(app)
                .post('/api/v1/agreements')
                .set('Authorization', `Bearer ${freelancerToken}`)
                .send({
                    ...body(),
                    clientWorkspaceId: freelancerWorkspace._id,
                    freelancerWorkspaceId: clientWorkspace._id,
                });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('INVALID_AGREEMENT_PARTICIPANTS');
        });

        it('should reject when endDate is before startDate', async () => {
            const res = await request(app)
                .post('/api/v1/agreements')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ ...body(), startDate: '2026-12-01', endDate: '2026-09-01' });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('GET /api/v1/agreements/:agreementId', () => {
        it('should return an agreement to a participant', async () => {
            const agreementId = await createDraftAgreement();

            const res = await request(app)
                .get(`/api/v1/agreements/${agreementId}`)
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data._id).toBe(agreementId);
        });

        it('should return 404 for non-participant', async () => {
            const agreementId = await createDraftAgreement();

            const res = await request(app)
                .get(`/api/v1/agreements/${agreementId}`)
                .set('Authorization', `Bearer ${outsiderToken}`);

            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('AGREEMENT_NOT_FOUND');
        });
    });

    describe('GET /api/v1/agreements/workspaces/:workspaceId', () => {
        it('should list agreements for a workspace member', async () => {
            const agreementId = await createDraftAgreement();

            const res = await request(app)
                .get(`/api/v1/agreements/workspaces/${clientWorkspace._id}`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBe(1);
            expect(res.body.data[0]._id).toBe(agreementId);
        });
    });

    describe('PATCH /api/v1/agreements/:agreementId', () => {
        it('should allow editing a DRAFT agreement by client owner', async () => {
            const agreementId = await createDraftAgreement();

            const res = await request(app)
                .patch(`/api/v1/agreements/${agreementId}`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ title: 'Updated Title' });

            expect(res.status).toBe(200);
            expect(res.body.data.title).toBe('Updated Title');
        });

        it('should reject partial update making endDate earlier than startDate', async () => {
            const agreementId = await createDraftAgreement();

            const res = await request(app)
                .patch(`/api/v1/agreements/${agreementId}`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ endDate: '2026-08-01' });

            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('State Transitions', () => {
        it('should transition DRAFT -> PROPOSED -> ACTIVE', async () => {
            const agreementId = await createDraftAgreement();

            const proposeRes = await request(app)
                .post(`/api/v1/agreements/${agreementId}/propose`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(proposeRes.status).toBe(200);
            expect(proposeRes.body.data.status).toBe('PROPOSED');
            expect(proposeRes.body.data.proposedBy).toBeDefined();

            const acceptRes = await request(app)
                .post(`/api/v1/agreements/${agreementId}/accept`)
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(acceptRes.status).toBe(200);
            expect(acceptRes.body.data.status).toBe('ACTIVE');
            expect(acceptRes.body.data.acceptedBy).toBeDefined();
        });

        it('should transition PROPOSED -> REJECTED', async () => {
            const agreementId = await createDraftAgreement();

            await request(app)
                .post(`/api/v1/agreements/${agreementId}/propose`)
                .set('Authorization', `Bearer ${clientToken}`);

            const rejectRes = await request(app)
                .post(`/api/v1/agreements/${agreementId}/reject`)
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(rejectRes.status).toBe(200);
            expect(rejectRes.body.data.status).toBe('REJECTED');
        });

        it('should transition DRAFT -> CANCELLED', async () => {
            const agreementId = await createDraftAgreement();

            const cancelRes = await request(app)
                .post(`/api/v1/agreements/${agreementId}/cancel`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(cancelRes.status).toBe(200);
            expect(cancelRes.body.data.status).toBe('CANCELLED');
        });

        it('should reject invalid transition DRAFT -> ACTIVE', async () => {
            const agreementId = await createDraftAgreement();

            const res = await request(app)
                .post(`/api/v1/agreements/${agreementId}/accept`)
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('INVALID_AGREEMENT_TRANSITION');
        });

        it('should reject invalid transition ACTIVE -> CANCELLED', async () => {
            const agreementId = await createDraftAgreement();

            await request(app)
                .post(`/api/v1/agreements/${agreementId}/propose`)
                .set('Authorization', `Bearer ${clientToken}`);

            await request(app)
                .post(`/api/v1/agreements/${agreementId}/accept`)
                .set('Authorization', `Bearer ${freelancerToken}`);

            const cancelRes = await request(app)
                .post(`/api/v1/agreements/${agreementId}/cancel`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(cancelRes.status).toBe(409);
            expect(cancelRes.body.error.code).toBe('INVALID_AGREEMENT_TRANSITION');
        });

        it('should return 409 when atomic transition loses a race', async () => {
            const agreementId = await createDraftAgreement();

            // Transition behind the scenes to PROPOSED
            const Agreement = mongoose.model('Agreement');
            await Agreement.findByIdAndUpdate(agreementId, { status: 'PROPOSED' });

            // Try to propose (expects DRAFT, but it is now PROPOSED)
            const res = await request(app)
                .post(`/api/v1/agreements/${agreementId}/propose`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe('INVALID_AGREEMENT_TRANSITION');
        });

        it('should never return HTTP 200 with data: null after a transition conflict', async () => {
            const agreementId = await createDraftAgreement();

            // Transition behind the scenes to CANCELLED
            const Agreement = mongoose.model('Agreement');
            await Agreement.findByIdAndUpdate(agreementId, { status: 'CANCELLED' });

            // Try to propose (expects DRAFT, but it is now CANCELLED)
            const res = await request(app)
                .post(`/api/v1/agreements/${agreementId}/propose`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).not.toBe(200);
            if (res.body.data !== undefined) {
                expect(res.body.data).not.toBeNull();
            }
        });
    });

    describe('RBAC', () => {
        it('should not allow freelancer to propose', async () => {
            const agreementId = await createDraftAgreement();

            const res = await request(app)
                .post(`/api/v1/agreements/${agreementId}/propose`)
                .set('Authorization', `Bearer ${freelancerToken}`);

            expect(res.status).toBe(403);
        });

        it('should not allow client to accept', async () => {
            const agreementId = await createDraftAgreement();

            await request(app)
                .post(`/api/v1/agreements/${agreementId}/propose`)
                .set('Authorization', `Bearer ${clientToken}`);

            const res = await request(app)
                .post(`/api/v1/agreements/${agreementId}/accept`)
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(403);
        });

        it('should not allow editing a PROPOSED agreement', async () => {
            const agreementId = await createDraftAgreement();

            await request(app)
                .post(`/api/v1/agreements/${agreementId}/propose`)
                .set('Authorization', `Bearer ${clientToken}`);

            const res = await request(app)
                .patch(`/api/v1/agreements/${agreementId}`)
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ title: 'Should Fail' });

            expect(res.status).toBe(409);
        });
    });
});
