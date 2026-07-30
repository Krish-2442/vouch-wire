import crypto from 'crypto';
import { authService } from '../services/auth.service.js';
import env from '../../../shared/config/env.js';
import { successResponse } from '../../../shared/utils/api-response.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

// Helper to convert '7d' etc to milliseconds
const getMaxAgeMs = (expiresInStr) => {
    const value = parseInt(expiresInStr.slice(0, -1), 10);
    const unit = expiresInStr.slice(-1);

    if (unit === 'd') {
        return value * 24 * 60 * 60 * 1000;
    } else if (unit === 'm') {
        return value * 60 * 1000;
    }
    return 7 * 24 * 60 * 60 * 1000; // fallback to 7 days
};

const getCookieOptions = () => ({
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: getMaxAgeMs(env.JWT_REFRESH_EXPIRES_IN),
});

const getClientInfo = (req) => {
    const userAgent = req.headers['user-agent'] || null;
    const ip = req.ip || req.connection.remoteAddress;
    const ipHash = ip ? crypto.createHash('sha256').update(ip).digest('hex') : null;

    return { userAgent, ipHash };
};

export const authController = {
    register: async (req, res, next) => {
        try {
            const { user, accessToken, refreshToken } = await authService.register(
                req.validated.body,
                getClientInfo(req),
            );

            res.cookie(env.REFRESH_COOKIE_NAME, refreshToken, getCookieOptions());

            return successResponse(res, { data: { user, accessToken }, statusCode: 201 });
        } catch (error) {
            next(error);
        }
    },

    login: async (req, res, next) => {
        try {
            const { email, password } = req.validated.body;
            const { user, accessToken, refreshToken } = await authService.login(
                email,
                password,
                getClientInfo(req),
            );

            res.cookie(env.REFRESH_COOKIE_NAME, refreshToken, getCookieOptions());

            return successResponse(res, { data: { user, accessToken } });
        } catch (error) {
            next(error);
        }
    },

    refresh: async (req, res, next) => {
        try {
            const oldRefreshToken = req.cookies[env.REFRESH_COOKIE_NAME];

            if (!oldRefreshToken) {
                const err = new Error('Refresh token is required');
                err.code = ErrorCodes.AUTHENTICATION_REQUIRED;
                err.statusCode = 401;
                throw err;
            }

            try {
                const { user, accessToken, refreshToken } = await authService.rotate(
                    oldRefreshToken,
                    getClientInfo(req),
                );

                res.cookie(env.REFRESH_COOKIE_NAME, refreshToken, getCookieOptions());

                return successResponse(res, { data: { user, accessToken } });
            } catch (error) {
                // Clear cookie on any rotation failure (including replay detection)
                res.clearCookie(env.REFRESH_COOKIE_NAME, {
                    ...getCookieOptions(),
                    maxAge: 0,
                });
                throw error;
            }
        } catch (error) {
            next(error);
        }
    },

    logout: async (req, res, next) => {
        try {
            const refreshToken = req.cookies[env.REFRESH_COOKIE_NAME];

            if (refreshToken) {
                await authService.logout(refreshToken);
            }

            res.clearCookie(env.REFRESH_COOKIE_NAME, {
                ...getCookieOptions(),
                maxAge: 0,
            });

            res.status(204).end();
        } catch (error) {
            next(error);
        }
    },

    me: async (req, res, next) => {
        try {
            return successResponse(res, { data: { user: req.auth.user } });
        } catch (error) {
            next(error);
        }
    },
};
