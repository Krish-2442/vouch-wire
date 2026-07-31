import request from 'supertest';
import { describe, it, expect } from 'vitest';
import createApp from '../../src/app.js';
import { setupTestDatabase } from '../helpers/database-lifecycle.helper.js';

const app = createApp();
setupTestDatabase();

const createUser = async (email, role = 'CLIENT') => {
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

describe('Workspace Memberships Endpoints', () => {
    it('should allow OWNER to add a new MEMBER', async () => {
        const ownerToken = await createUser('owner1@test.com', 'CLIENT');
        await createUser('member1@test.com', 'CLIENT');

        const wsRes = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Team Workspace' });
        const workspaceId = wsRes.body.data.workspace._id;

        const addRes = await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member1@test.com' });

        expect(addRes.status).toBe(201);
        expect(addRes.body.data.membershipRole).toBe('MEMBER');
    });

    it('should block MEMBER from adding new members', async () => {
        const ownerToken = await createUser('owner2@test.com', 'CLIENT');
        const memberToken = await createUser('member2@test.com', 'CLIENT');
        await createUser('member3@test.com', 'CLIENT');

        const wsRes = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Team Workspace 2' });
        const workspaceId = wsRes.body.data.workspace._id;

        await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member2@test.com' });

        const addRes = await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/members`)
            .set('Authorization', `Bearer ${memberToken}`)
            .send({ email: 'member3@test.com' });

        expect(addRes.status).toBe(403);
    });

    it('should reject adding a user with a different role type', async () => {
        const ownerToken = await createUser('owner3@test.com', 'CLIENT');
        await createUser('freelancer1@test.com', 'FREELANCER');

        const wsRes = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Client Workspace' });
        const workspaceId = wsRes.body.data.workspace._id;

        const addRes = await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'freelancer1@test.com' });

        expect(addRes.status).toBe(400);
        expect(addRes.body.error.code).toBe('MEMBER_NOT_ELIGIBLE');
    });

    it('should list members without leaking sensitive info', async () => {
        const ownerToken = await createUser('owner4@test.com', 'CLIENT');
        await createUser('member4@test.com', 'CLIENT');

        const wsRes = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Public Workspace' });
        const workspaceId = wsRes.body.data.workspace._id;

        await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member4@test.com' });

        const listRes = await request(app)
            .get(`/api/v1/workspaces/${workspaceId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`);

        expect(listRes.status).toBe(200);
        expect(listRes.body.data).toHaveLength(2);
        expect(listRes.body.data[0].user.passwordHash).toBeUndefined();
    });

    it('should allow OWNER to remove a MEMBER', async () => {
        const ownerToken = await createUser('owner5@test.com', 'CLIENT');
        await createUser('member5@test.com', 'CLIENT');

        const wsRes = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Remove Workspace' });
        const workspaceId = wsRes.body.data.workspace._id;

        const addRes = await request(app)
            .post(`/api/v1/workspaces/${workspaceId}/members`)
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ email: 'member5@test.com' });
        const membershipId = addRes.body.data._id;

        const removeRes = await request(app)
            .delete(`/api/v1/workspaces/${workspaceId}/members/${membershipId}`)
            .set('Authorization', `Bearer ${ownerToken}`);

        expect(removeRes.status).toBe(204);
    });

    it('should not allow OWNER to remove another OWNER', async () => {
        const ownerToken = await createUser('owner6@test.com', 'CLIENT');

        const wsRes = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Owner Remove Workspace' });
        const workspaceId = wsRes.body.data.workspace._id;
        const membershipId = wsRes.body.data.membership._id;

        const removeRes = await request(app)
            .delete(`/api/v1/workspaces/${workspaceId}/members/${membershipId}`)
            .set('Authorization', `Bearer ${ownerToken}`);

        expect(removeRes.status).toBe(400);
        expect(removeRes.body.error.code).toBe('OWNER_MEMBERSHIP_PROTECTED');
    });

    it('should isolate workspaces so one user cannot read another workspace', async () => {
        const ownerToken = await createUser('owner7@test.com', 'CLIENT');
        const maliciousToken = await createUser('malicious@test.com', 'CLIENT');

        const wsRes = await request(app)
            .post('/api/v1/workspaces')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({ name: 'Private Workspace' });
        const workspaceId = wsRes.body.data.workspace._id;

        const readRes = await request(app)
            .get(`/api/v1/workspaces/${workspaceId}`)
            .set('Authorization', `Bearer ${maliciousToken}`);

        expect(readRes.status).toBe(404); // Using 404 safely as per middleware logic
    });
});
