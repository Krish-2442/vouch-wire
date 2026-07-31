import { authService } from '../services/auth.service.js';
import { tokenService } from '../services/token.service.js';
import env from '../../../shared/config/env.js';
import { successResponse } from '../../../shared/utils/api-response.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';
import { AppError } from '../../../shared/errors/app-error.js';

const getCookieOptions = () => ({
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: tokenService.getRefreshMaxAgeMs(),
});

const getClientInfo = (req) => {
    const userAgent = req.headers['user-agent'] || null;
    const ip = req.ip || req.connection?.remoteAddress || null;

    return { userAgent, ip };
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
                throw new AppError(
                    ErrorCodes.AUTHENTICATION_REQUIRED,
                    401,
                    'Refresh token is required',
                );
            }

            try {
                const { user, accessToken, refreshToken } = await authService.rotate(
                    oldRefreshToken,
                    getClientInfo(req),
                );

                res.cookie(env.REFRESH_COOKIE_NAME, refreshToken, getCookieOptions());

                return successResponse(res, { data: { user, accessToken } });
            } catch (error) {
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
