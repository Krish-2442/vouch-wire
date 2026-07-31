import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import createApp from '../../src/app.js';
import { setupTestDatabase } from '../helpers/database-lifecycle.helper.js';
import { requestIdMiddleware } from '../../src/shared/middlewares/request-id.middleware.js';
import { errorHandlerMiddleware } from '../../src/shared/middlewares/error-handler.middleware.js';
import { authenticate } from '../../src/shared/middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../src/shared/middlewares/authorize-roles.middleware.js';

const app = createApp();

const testApp = express();
testApp.use(express.json());
testApp.use(requestIdMiddleware);
testApp.get('/test-admin', authenticate, authorizeRoles('ADMIN'), (req, res) =>
    res.status(200).json({ ok: true }),
);
testApp.get('/test-client', authenticate, authorizeRoles('CLIENT'), (req, res) =>
    res.status(200).json({ ok: true }),
);
testApp.get('/test-freelancer', authenticate, authorizeRoles('FREELANCER'), (req, res) =>
    res.status(200).json({ ok: true }),
);
testApp.use(errorHandlerMiddleware);

setupTestDatabase();

describe('Authorization Middleware', () => {
    let clientToken = '';
    let freelancerToken = '';

    beforeEach(async () => {
        const resClient = await request(app).post('/api/v1/auth/register').send({
            fullName: 'Client User',
            email: 'client@example.com',
            password: 'password123456',
            role: 'CLIENT',
        });
        clientToken = resClient.body.data.accessToken;

        const resFreelancer = await request(app).post('/api/v1/auth/register').send({
            fullName: 'Freelancer User',
            email: 'freelancer@example.com',
            password: 'password123456',
            role: 'FREELANCER',
        });
        freelancerToken = resFreelancer.body.data.accessToken;
    });

    it('should deny client access to admin route', async () => {
        const response = await request(testApp)
            .get('/test-admin')
            .set('Authorization', `Bearer ${clientToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow client access to client route', async () => {
        const response = await request(testApp)
            .get('/test-client')
            .set('Authorization', `Bearer ${clientToken}`);

        expect(response.status).toBe(200);
    });

    it('should deny freelancer access to client route', async () => {
        const response = await request(testApp)
            .get('/test-client')
            .set('Authorization', `Bearer ${freelancerToken}`);

        expect(response.status).toBe(403);
    });

    it('should allow freelancer access to freelancer route', async () => {
        const response = await request(testApp)
            .get('/test-freelancer')
            .set('Authorization', `Bearer ${freelancerToken}`);

        expect(response.status).toBe(200);
    });
});
