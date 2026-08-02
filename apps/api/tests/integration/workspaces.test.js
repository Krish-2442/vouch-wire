import request from 'supertest';
import argon2 from 'argon2';
import { describe, it, expect } from 'vitest';
import createApp from '../../src/app.js';
import { User } from '../../src/domains/identity/models/user.model.js';
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

const createAdminUser = async (email) => {
    const passwordHash = await argon2.hash('password123456');
    await User.create({
        fullName: 'Admin User',
        email,
        passwordHash,
        role: 'ADMIN',
    });
    const loginRes = await request(app).post('/api/v1/auth/login').send({
        email,
        password: 'password123456',
    });
    return loginRes.body.data.accessToken;
};

describe('Workspaces Endpoints', () => {
    describe('POST /api/v1/workspaces', () => {
        it('should create a workspace for a CLIENT user', async () => {
            const token = await createUser('client@test.com', 'CLIENT');

            const res = await request(app)
                .post('/api/v1/workspaces')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Client Workspace' });

            expect(res.status).toBe(201);
            expect(res.body.data.workspace.name).toBe('Client Workspace');
            expect(res.body.data.workspace.slug).toBe('client-workspace');
            expect(res.body.data.workspace.workspaceType).toBe('CLIENT');
            expect(res.body.data.membership.membershipRole).toBe('OWNER');
        });

        it('should reject workspace creation for an ADMIN user', async () => {
            const token = await createAdminUser('admin@test.com');

            const res = await request(app)
                .post('/api/v1/workspaces')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Admin Workspace' });

            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe('FORBIDDEN');
        });
    });

    describe('GET /api/v1/workspaces', () => {
        it('should list workspaces for the user', async () => {
            const token = await createUser('client2@test.com', 'CLIENT');
            await request(app)
                .post('/api/v1/workspaces')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Workspace 1' });
            await request(app)
                .post('/api/v1/workspaces')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Workspace 2' });

            const res = await request(app)
                .get('/api/v1/workspaces')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0].membershipRole).toBe('OWNER');
            expect(res.body.data[0].workspace.name).toBeDefined();
        });
    });

    describe('PATCH /api/v1/workspaces/:workspaceId', () => {
        it('should allow OWNER to update workspace name', async () => {
            const token = await createUser('owner@test.com', 'CLIENT');
            const wsRes = await request(app)
                .post('/api/v1/workspaces')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Old Name' });
            const workspaceId = wsRes.body.data.workspace._id;

            const updateRes = await request(app)
                .patch(`/api/v1/workspaces/${workspaceId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'New Name' });

            expect(updateRes.status).toBe(200);
            expect(updateRes.body.data.name).toBe('New Name');
            expect(updateRes.body.data.slug).toBe('old-name');
        });
    });
});
