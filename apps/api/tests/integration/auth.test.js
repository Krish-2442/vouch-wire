import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import createApp from '../../src/app.js';
import { User } from '../../src/domains/identity/models/user.model.js';
import { RefreshSession } from '../../src/domains/identity/models/refresh-session.model.js';
import env from '../../src/shared/config/env.js';

import { setupTestDatabase } from '../helpers/database-lifecycle.helper.js';

const app = createApp();

setupTestDatabase();

describe('Auth Endpoints', () => {
    describe('POST /api/v1/auth/register', () => {
        it('should register a new client user successfully', async () => {
            const response = await request(app).post('/api/v1/auth/register').send({
                fullName: 'Test User',
                email: 'test@example.com',
                password: 'password123456',
                role: 'CLIENT',
            });

            expect(response.status).toBe(201);
            expect(response.body.data.user).toBeDefined();
            expect(response.body.data.accessToken).toBeDefined();
            expect(response.body.data.user.email).toBe('test@example.com');
            expect(response.body.data.user.role).toBe('CLIENT');

            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            expect(cookies[0]).toContain(env.REFRESH_COOKIE_NAME);

            const decodeJwtPayload = (token) =>
                JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            const accessJti = decodeJwtPayload(response.body.data.accessToken).jti;
            const refreshTokenStr = cookies[0].split(';')[0].split('=')[1];
            const refreshJti = decodeJwtPayload(refreshTokenStr).jti;
            expect(accessJti).toBeDefined();
            expect(refreshJti).toBeDefined();
            expect(accessJti).not.toBe(refreshJti);

            const userInDb = await User.findOne({ email: 'test@example.com' });
            expect(userInDb).toBeDefined();
        });

        it('should fail with validation error when password is too short', async () => {
            const response = await request(app).post('/api/v1/auth/register').send({
                fullName: 'Test User',
                email: 'test@example.com',
                password: 'short',
                role: 'CLIENT',
            });

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should fail if email already exists', async () => {
            await request(app).post('/api/v1/auth/register').send({
                fullName: 'Test User',
                email: 'duplicate@example.com',
                password: 'password123456',
                role: 'CLIENT',
            });

            const response = await request(app).post('/api/v1/auth/register').send({
                fullName: 'Another User',
                email: 'duplicate@example.com',
                password: 'password123456',
                role: 'FREELANCER',
            });

            expect(response.status).toBe(409);
            expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
        });
    });

    describe('POST /api/v1/auth/login', () => {
        beforeEach(async () => {
            await request(app).post('/api/v1/auth/register').send({
                fullName: 'Login User',
                email: 'login@example.com',
                password: 'password123456',
                role: 'FREELANCER',
            });
        });

        it('should login successfully with correct credentials', async () => {
            const response = await request(app).post('/api/v1/auth/login').send({
                email: 'login@example.com',
                password: 'password123456',
            });

            expect(response.status).toBe(200);
            expect(response.body.data.accessToken).toBeDefined();
            const cookies = response.headers['set-cookie'];
            expect(cookies[0]).toContain(env.REFRESH_COOKIE_NAME);
        });

        it('should return 401 for unknown email', async () => {
            const response = await request(app).post('/api/v1/auth/login').send({
                email: 'unknown@example.com',
                password: 'password123456',
            });

            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
        });

        it('should return 401 for incorrect password', async () => {
            const response = await request(app).post('/api/v1/auth/login').send({
                email: 'login@example.com',
                password: 'wrongpassword',
            });

            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
        });
    });

    describe('Token Rotation and Replay Detection', () => {
        let oldRefreshTokenCookie = '';

        beforeEach(async () => {
            const uniqueEmail = `rotate-${Date.now()}-${Math.random()}@example.com`;
            const response = await request(app).post('/api/v1/auth/register').send({
                fullName: 'Rotate User',
                email: uniqueEmail,
                password: 'password123456',
                role: 'CLIENT',
            });

            oldRefreshTokenCookie = response.headers['set-cookie'][0].split(';')[0];
        });

        it('should rotate refresh token successfully', async () => {
            const response = await request(app)
                .post('/api/v1/auth/refresh')
                .set('Cookie', oldRefreshTokenCookie);

            expect(response.status).toBe(200);
            expect(response.body.data.accessToken).toBeDefined();
            const newCookie = response.headers['set-cookie'][0];
            expect(newCookie).toContain(env.REFRESH_COOKIE_NAME);
            expect(newCookie).not.toEqual(oldRefreshTokenCookie);

            // Verify old session is revoked
            const oldSession = await RefreshSession.findOne({ revokedAt: { $ne: null } });
            expect(oldSession).toBeDefined();
            expect(oldSession.revokedReason).toBe('ROTATED');
            expect(oldSession.replacedBySessionId).not.toBeNull();
        });

        it('should detect replay and fail concurrent requests with the exact same token', async () => {
            // First we need to make sure the token is rotated once, to make it "old"
            await request(app).post('/api/v1/auth/refresh').set('Cookie', oldRefreshTokenCookie);

            // Now, simulate two concurrent requests trying to reuse the ALREADY ROTATED token (replay attack)
            const concurrentReq1 = request(app)
                .post('/api/v1/auth/refresh')
                .set('Cookie', oldRefreshTokenCookie);

            const concurrentReq2 = request(app)
                .post('/api/v1/auth/refresh')
                .set('Cookie', oldRefreshTokenCookie);

            const results = await Promise.all([concurrentReq1, concurrentReq2]);

            // Both requests should fail with 401 because the token is already revoked
            expect(results[0].status).toBe(401);
            expect(results[1].status).toBe(401);

            // Verify family was revoked
            const familySessions = await RefreshSession.find({});
            expect(familySessions.length).toBeGreaterThan(0);
            familySessions.forEach((session) => {
                expect(session.revokedAt).toBeDefined();
                expect(session.revokedAt).not.toBeNull();
            });
        });

        it('concurrency test for valid rotation (only one wins)', async () => {
            // Simulate two concurrent requests trying to rotate the CURRENT valid token
            const concurrentReq1 = request(app)
                .post('/api/v1/auth/refresh')
                .set('Cookie', oldRefreshTokenCookie);

            const concurrentReq2 = request(app)
                .post('/api/v1/auth/refresh')
                .set('Cookie', oldRefreshTokenCookie);

            const results = await Promise.all([concurrentReq1, concurrentReq2]);

            // EXACTLY one should succeed and one should fail because the transaction guarantees atomic rotation
            const statusCodes = results.map((r) => r.status).sort();
            expect(statusCodes).toEqual([200, 401]);
        });

        it('should return 401 if refresh JWT user mismatch', async () => {
            const res1 = await request(app).post('/api/v1/auth/register').send({
                fullName: 'Mismatch User 1',
                email: 'mismatch1@example.com',
                password: 'password123456',
                role: 'CLIENT',
            });
            const cookie1 = res1.headers['set-cookie'][0].split(';')[0];

            const res2 = await request(app).post('/api/v1/auth/register').send({
                fullName: 'Mismatch User 2',
                email: 'mismatch2@example.com',
                password: 'password123456',
                role: 'CLIENT',
            });

            await RefreshSession.updateOne(
                { userId: res1.body.data.user._id },
                { $set: { userId: res2.body.data.user._id } },
            );

            const response = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie1);

            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe('INVALID_TOKEN');
        });

        it('should return 403 if account is inactive during refresh', async () => {
            const uniqueEmail = `inactive-${Date.now()}-${Math.random()}@example.com`;
            const res = await request(app).post('/api/v1/auth/register').send({
                fullName: 'Inactive User',
                email: uniqueEmail,
                password: 'password123456',
                role: 'CLIENT',
            });
            const cookie = res.headers['set-cookie'][0].split(';')[0];

            await User.updateOne({ email: uniqueEmail }, { $set: { isActive: false } });

            const response = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
            expect(response.status).toBe(403);
            expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
        });
    });

    describe('POST /api/v1/auth/logout', () => {
        let logoutCookie = '';

        beforeEach(async () => {
            const uniqueEmail = `logout-${Date.now()}-${Math.random()}@example.com`;
            const response = await request(app).post('/api/v1/auth/register').send({
                fullName: 'Logout User',
                email: uniqueEmail,
                password: 'password123456',
                role: 'CLIENT',
            });
            logoutCookie = response.headers['set-cookie'][0].split(';')[0];
        });

        it('should logout successfully and clear cookie', async () => {
            const response = await request(app)
                .post('/api/v1/auth/logout')
                .set('Cookie', logoutCookie);

            expect(response.status).toBe(204);

            const cookies = response.headers['set-cookie'];
            expect(cookies).toBeDefined();
            // The clearCookie sets maxAge=0 or Max-Age=0 or expires in the past
            expect(cookies[0]).toContain(env.REFRESH_COOKIE_NAME);
            expect(cookies[0]).toMatch(/Max-Age=0|Expires=/i);

            // Verify session is revoked
            const tokenStr = logoutCookie.split('=')[1];
            const decodeJwtPayload = (token) =>
                JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            const jti = decodeJwtPayload(tokenStr).jti;

            const session = await RefreshSession.findOne({ jti });
            expect(session).toBeDefined();
            expect(session.revokedReason).toBe('LOGGED_OUT');
            expect(session.replacedBySessionId).toBeNull();
        });
    });

    describe('GET /api/v1/auth/me', () => {
        let accessToken = '';
        let uniqueEmailStore = '';

        beforeEach(async () => {
            const uniqueEmail = `me-${Date.now()}-${Math.random()}@example.com`;
            const response = await request(app).post('/api/v1/auth/register').send({
                fullName: 'Me User',
                email: uniqueEmail,
                password: 'password123456',
                role: 'FREELANCER',
            });

            accessToken = response.body.data.accessToken;
            // Also store the unique email to assert later
            uniqueEmailStore = uniqueEmail;
        });

        it('should return current user with valid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.user.email).toBe(uniqueEmailStore);
            expect(response.body.data.user.role).toBe('FREELANCER');
        });

        it('should fail with missing token', async () => {
            const response = await request(app).get('/api/v1/auth/me');

            expect(response.status).toBe(401);
        });

        it('should fail with invalid token', async () => {
            const response = await request(app)
                .get('/api/v1/auth/me')
                .set('Authorization', `Bearer invalid-token`);

            expect(response.status).toBe(401);
        });
    });
});
