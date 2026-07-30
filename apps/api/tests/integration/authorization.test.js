import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import createApp from '../../src/app.js';
import { authorizeRoles } from '../../src/shared/middlewares/authorize-roles.middleware.js';
import { authenticate } from '../../src/shared/middlewares/authenticate.middleware.js';

const app = createApp();

// Dummy routes have been moved to routes.js inside identity domain with /auth prefix

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
        const response = await request(app)
            .get('/api/v1/auth/test-admin')
            .set('Authorization', `Bearer ${clientToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow client access to client route', async () => {
        const response = await request(app)
            .get('/api/v1/auth/test-client')
            .set('Authorization', `Bearer ${clientToken}`);

        expect(response.status).toBe(200);
    });

    it('should deny freelancer access to client route', async () => {
        const response = await request(app)
            .get('/api/v1/auth/test-client')
            .set('Authorization', `Bearer ${freelancerToken}`);

        expect(response.status).toBe(403);
    });

    it('should allow freelancer access to freelancer route', async () => {
        const response = await request(app)
            .get('/api/v1/auth/test-freelancer')
            .set('Authorization', `Bearer ${freelancerToken}`);

        expect(response.status).toBe(200);
    });
});
