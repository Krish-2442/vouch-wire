import request from 'supertest';
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

describe('Milestones Endpoints', () => {
    let clientOwnerToken, clientMemberToken;
    let freelancerOwnerToken;
    let outsiderToken;
    let clientWorkspace, freelancerWorkspace;
    let activeAgreementId, draftAgreementId;

    beforeEach(async () => {
        clientOwnerToken = await registerAndLogin('milestone-co@test.com', 'CLIENT');
        clientMemberToken = await registerAndLogin('milestone-cm@test.com', 'CLIENT');
        freelancerOwnerToken = await registerAndLogin('milestone-fo@test.com', 'FREELANCER');
        outsiderToken = await registerAndLogin('milestone-out@test.com', 'CLIENT');

        const cws = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({ name: 'Milestone Client' });
        clientWorkspace = cws.body.data.workspace;

        await request(app)
            .post(`/api/v1/workspaces/${clientWorkspace._id}/members`)
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({ email: 'milestone-cm@test.com' });

        const fws = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${freelancerOwnerToken}`)
            .send({ name: 'Milestone Freelancer' });
        freelancerWorkspace = fws.body.data.workspace;

        const draftRes = await request(app)
            .post('/api/v1/agreements')
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({
                clientWorkspaceId: clientWorkspace._id,
                freelancerWorkspaceId: freelancerWorkspace._id,
                title: 'Draft Agreement',
                scope: 'Test Scope',
                currency: 'USD',
                contractAmountMinor: 500000,
                startDate: '2026-09-01',
                endDate: '2026-12-01',
            });
        draftAgreementId = draftRes.body.data._id;

        const activeRes = await request(app)
            .post('/api/v1/agreements')
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({
                clientWorkspaceId: clientWorkspace._id,
                freelancerWorkspaceId: freelancerWorkspace._id,
                title: 'Active Agreement',
                scope: 'Test Scope',
                currency: 'USD',
                contractAmountMinor: 500000,
                startDate: '2026-09-01',
                endDate: '2026-12-01',
            });
        activeAgreementId = activeRes.body.data._id;

        await request(app)
            .post(`/api/v1/agreements/${activeAgreementId}/propose`)
            .set('Authorization', `Bearer ${clientOwnerToken}`);

        await request(app)
            .post(`/api/v1/agreements/${activeAgreementId}/accept`)
            .set('Authorization', `Bearer ${freelancerOwnerToken}`);
    });

    const createMilestone = async (token, agreementId, overrides = {}) => {
        return request(app)
            .post(`/api/v1/milestones/agreements/${agreementId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Milestone 1',
                amountMinor: 100000,
                sequence: 1,
                dueDate: '2026-10-01',
                ...overrides,
            });
    };

    it('should include meta.requestId in every successful response', async () => {
        const res = await createMilestone(clientOwnerToken, activeAgreementId);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.meta).toBeDefined();
        expect(res.body.meta.requestId).toBeDefined();
    });

    it('should allow client OWNER to create milestone on ACTIVE agreement', async () => {
        const res = await createMilestone(clientOwnerToken, activeAgreementId);
        expect(res.status).toBe(201);
        expect(res.body.data.title).toBe('Milestone 1');
        expect(res.body.data.status).toBe('DRAFT');
    });

    it('should reject creation on DRAFT agreement', async () => {
        const res = await createMilestone(clientOwnerToken, draftAgreementId);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('AGREEMENT_NOT_ACTIVE');
    });

    it('should reject creation by client MEMBER (non-owner)', async () => {
        const res = await createMilestone(clientMemberToken, activeAgreementId);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('MILESTONE_ACCESS_DENIED');
    });

    it('should reject creation by freelancer', async () => {
        const res = await createMilestone(freelancerOwnerToken, activeAgreementId);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('MILESTONE_ACCESS_DENIED');
    });

    it('should reject due date outside agreement bounds', async () => {
        const res = await createMilestone(clientOwnerToken, activeAgreementId, {
            dueDate: '2025-01-01',
        });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce sequence uniqueness per agreement (409 conflict)', async () => {
        await createMilestone(clientOwnerToken, activeAgreementId, { sequence: 1 });
        const res = await createMilestone(clientOwnerToken, activeAgreementId, { sequence: 1 });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('CONFLICT');
    });

    it('should allow active members to read/list milestones with pagination metadata', async () => {
        await createMilestone(clientOwnerToken, activeAgreementId, { sequence: 1 });
        await createMilestone(clientOwnerToken, activeAgreementId, { sequence: 2 });

        const listRes = await request(app)
            .get(`/api/v1/milestones/agreements/${activeAgreementId}`)
            .set('Authorization', `Bearer ${freelancerOwnerToken}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.data.length).toBe(2);
        expect(listRes.body.meta.pagination.total).toBe(2);
        expect(listRes.body.meta.pagination.page).toBe(1);
        expect(listRes.body.meta.pagination.limit).toBe(10);
        expect(listRes.body.meta.requestId).toBeDefined();

        const milestoneId = listRes.body.data[0]._id;
        const getRes = await request(app)
            .get(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${clientMemberToken}`);

        expect(getRes.status).toBe(200);
        expect(getRes.body.data._id).toBe(milestoneId);
        expect(getRes.body.meta.requestId).toBeDefined();
    });

    it('should paginate milestone list correctly', async () => {
        await createMilestone(clientOwnerToken, activeAgreementId, {
            sequence: 1,
            title: 'First',
        });
        await createMilestone(clientOwnerToken, activeAgreementId, {
            sequence: 2,
            title: 'Second',
        });
        await createMilestone(clientOwnerToken, activeAgreementId, {
            sequence: 3,
            title: 'Third',
        });

        const page1 = await request(app)
            .get(`/api/v1/milestones/agreements/${activeAgreementId}?page=1&limit=2`)
            .set('Authorization', `Bearer ${clientOwnerToken}`);

        expect(page1.status).toBe(200);
        expect(page1.body.data.length).toBe(2);
        expect(page1.body.meta.pagination.total).toBe(3);
        expect(page1.body.data[0].sequence).toBe(1);

        const page2 = await request(app)
            .get(`/api/v1/milestones/agreements/${activeAgreementId}?page=2&limit=2`)
            .set('Authorization', `Bearer ${clientOwnerToken}`);

        expect(page2.status).toBe(200);
        expect(page2.body.data.length).toBe(1);
        expect(page2.body.data[0].sequence).toBe(3);
    });

    it('should reject outsider from reading milestones (safe 404)', async () => {
        const createRes = await createMilestone(clientOwnerToken, activeAgreementId);
        const milestoneId = createRes.body.data._id;

        const res = await request(app)
            .get(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${outsiderToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('MILESTONE_NOT_FOUND');
    });

    it('should reject outsider from listing milestones (safe 404)', async () => {
        const res = await request(app)
            .get(`/api/v1/milestones/agreements/${activeAgreementId}`)
            .set('Authorization', `Bearer ${outsiderToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('MILESTONE_NOT_FOUND');
    });

    it('should reject update if milestone is not in DRAFT status', async () => {
        const createRes = await createMilestone(clientOwnerToken, activeAgreementId);
        const milestoneId = createRes.body.data._id;

        const mongoose = (await import('mongoose')).default;
        const Milestone = mongoose.model('Milestone');
        await Milestone.findByIdAndUpdate(milestoneId, { status: 'FUNDED' });

        const patchRes = await request(app)
            .patch(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({ title: 'Should Fail' });

        expect(patchRes.status).toBe(409);
        expect(patchRes.body.error.code).toBe('MILESTONE_NOT_EDITABLE');
    });

    it('should reject delete if milestone is not in DRAFT status', async () => {
        const createRes = await createMilestone(clientOwnerToken, activeAgreementId);
        const milestoneId = createRes.body.data._id;

        const mongoose = (await import('mongoose')).default;
        const Milestone = mongoose.model('Milestone');
        await Milestone.findByIdAndUpdate(milestoneId, { status: 'FUNDED' });

        const delRes = await request(app)
            .delete(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${clientOwnerToken}`);

        expect(delRes.status).toBe(409);
        expect(delRes.body.error.code).toBe('MILESTONE_NOT_EDITABLE');
    });

    it('should allow client OWNER to update DRAFT milestone', async () => {
        const createRes = await createMilestone(clientOwnerToken, activeAgreementId);
        const milestoneId = createRes.body.data._id;

        const patchRes = await request(app)
            .patch(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({ title: 'Updated Milestone' });

        expect(patchRes.status).toBe(200);
        expect(patchRes.body.data.title).toBe('Updated Milestone');
        expect(patchRes.body.meta.requestId).toBeDefined();
    });

    it('should reject update with empty body', async () => {
        const createRes = await createMilestone(clientOwnerToken, activeAgreementId);
        const milestoneId = createRes.body.data._id;

        const patchRes = await request(app)
            .patch(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${clientOwnerToken}`)
            .send({});

        expect(patchRes.status).toBe(400);
        expect(patchRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow client OWNER to delete DRAFT milestone', async () => {
        const createRes = await createMilestone(clientOwnerToken, activeAgreementId);
        const milestoneId = createRes.body.data._id;

        const delRes = await request(app)
            .delete(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${clientOwnerToken}`);

        expect(delRes.status).toBe(204);

        const getRes = await request(app)
            .get(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${clientOwnerToken}`);

        expect(getRes.status).toBe(404);
    });

    it('should reject outsider from updating a milestone (safe 404)', async () => {
        const createRes = await createMilestone(clientOwnerToken, activeAgreementId);
        const milestoneId = createRes.body.data._id;

        const patchRes = await request(app)
            .patch(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${outsiderToken}`)
            .send({ title: 'Hacked' });

        expect(patchRes.status).toBe(404);
        expect(patchRes.body.error.code).toBe('MILESTONE_NOT_FOUND');
    });

    it('should reject outsider from deleting a milestone (safe 404)', async () => {
        const createRes = await createMilestone(clientOwnerToken, activeAgreementId);
        const milestoneId = createRes.body.data._id;

        const delRes = await request(app)
            .delete(`/api/v1/milestones/${milestoneId}`)
            .set('Authorization', `Bearer ${outsiderToken}`);

        expect(delRes.status).toBe(404);
        expect(delRes.body.error.code).toBe('MILESTONE_NOT_FOUND');
    });
});
