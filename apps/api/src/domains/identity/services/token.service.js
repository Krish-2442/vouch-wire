import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../../../shared/config/env.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

export const tokenService = {
    generateAccessToken: (user) => {
        const payload = {
            sub: user._id.toString(),
            role: user.role,
            type: 'access',
        };

        return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
            expiresIn: env.JWT_ACCESS_EXPIRES_IN,
            issuer: env.JWT_ISSUER,
            audience: env.JWT_AUDIENCE,
        });
    },

    generateRefreshToken: (user, jti) => {
        const payload = {
            sub: user._id.toString(),
            role: user.role,
            type: 'refresh',
            jti,
        };

        return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
            expiresIn: env.JWT_REFRESH_EXPIRES_IN,
            issuer: env.JWT_ISSUER,
            audience: env.JWT_AUDIENCE,
        });
    },

    verifyAccessToken: (token) => {
        try {
            const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
                issuer: env.JWT_ISSUER,
                audience: env.JWT_AUDIENCE,
            });

            if (decoded.type !== 'access') {
                const err = new Error('Invalid token type');
                err.code = ErrorCodes.INVALID_TOKEN;
                err.statusCode = 401;
                throw err;
            }

            return decoded;
        } catch (error) {
            const err = new Error(error.message);
            err.code = ErrorCodes.INVALID_TOKEN;
            err.statusCode = 401;
            throw err;
        }
    },

    verifyRefreshToken: (token) => {
        try {
            const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
                issuer: env.JWT_ISSUER,
                audience: env.JWT_AUDIENCE,
            });

            if (decoded.type !== 'refresh') {
                const err = new Error('Invalid token type');
                err.code = ErrorCodes.INVALID_TOKEN;
                err.statusCode = 401;
                throw err;
            }

            return decoded;
        } catch (error) {
            const err = new Error(error.message);
            err.code = ErrorCodes.INVALID_TOKEN;
            err.statusCode = 401;
            throw err;
        }
    },

    hashToken: (token) => {
        return crypto.createHash('sha256').update(token).digest('hex');
    },

    generateJti: () => {
        return crypto.randomUUID();
    },

    generateFamilyId: () => {
        return crypto.randomUUID();
    },
};
