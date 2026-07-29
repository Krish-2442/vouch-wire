import { describe, it, expect } from 'vitest';
import request from 'supertest';
import createApp from '../../src/app.js';

const app = createApp();

describe('Health Endpoints', () => {
    describe('GET /api/v1/system/health/live', () => {
        it('should return 200 with success envelope', async () => {
            const res = await request(app).get('/api/v1/system/health/live');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('status', 'alive');
            expect(res.body.data).toHaveProperty('timestamp');
            expect(res.body.meta).toHaveProperty('requestId');
        });
    });

    describe('Unknown route', () => {
        it('should return 404 with error envelope', async () => {
            const res = await request(app).get('/api/v1/nonexistent');

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
            expect(res.body.error).toHaveProperty('message');
            expect(res.body.meta).toHaveProperty('requestId');
        });
    });

    describe('App import', () => {
        it('should import app.js without starting an HTTP listener', async () => {
            const module = await import('../../src/app.js');
            expect(typeof module.default).toBe('function');
        });
    });
});
