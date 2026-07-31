import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../../../shared/config/env.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';
import { AppError } from '../../../shared/errors/app-error.js';

const parseDurationToMs = (expiresInStr) => {
    const value = parseInt(expiresInStr.slice(0, -1), 10);
    const unit = expiresInStr.slice(-1);

    if (unit === 'd') return value * 24 * 60 * 60 * 1000;
    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'm') return value * 60 * 1000;
    if (unit === 's') return value * 1000;
    return 0;
};

export const tokenService = {
    generateAccessToken: (user, jti) => {
        const payload = {
            sub: user._id.toString(),
            role: user.role,
            type: 'access',
            jti,
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
                throw new AppError(ErrorCodes.INVALID_TOKEN, 401, 'Invalid token type');
            }

            return decoded;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError(ErrorCodes.INVALID_TOKEN, 401, error.message);
        }
    },

    verifyRefreshToken: (token) => {
        try {
            const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
                issuer: env.JWT_ISSUER,
                audience: env.JWT_AUDIENCE,
            });

            if (decoded.type !== 'refresh') {
                throw new AppError(ErrorCodes.INVALID_TOKEN, 401, 'Invalid token type');
            }

            return decoded;
        } catch (error) {
            if (error instanceof AppError) throw error;
            throw new AppError(ErrorCodes.INVALID_TOKEN, 401, error.message);
        }
    },

    hashToken: (token) => {
        return crypto.createHash('sha256').update(token).digest('hex');
    },

    verifyTokenHash: (token, storedHash) => {
        const computedHash = tokenService.hashToken(token);
        if (computedHash.length !== storedHash.length) return false;
        return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
    },

    generateJti: () => {
        return crypto.randomUUID();
    },

    generateFamilyId: () => {
        return crypto.randomUUID();
    },

    getRefreshMaxAgeMs: () => {
        return parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN);
    },

    getRefreshExpiresAt: () => {
        return new Date(Date.now() + tokenService.getRefreshMaxAgeMs());
    },
};
