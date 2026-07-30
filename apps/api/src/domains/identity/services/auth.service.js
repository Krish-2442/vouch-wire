import argon2 from 'argon2';
import mongoose from 'mongoose';
import { userRepository } from '../repositories/user.repository.js';
import { refreshSessionRepository } from '../repositories/refresh-session.repository.js';
import { tokenService } from './token.service.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';
import env from '../../../shared/config/env.js';

// Helper to parse duration string like '7d' to date
const getExpiresAt = (expiresInStr) => {
    const value = parseInt(expiresInStr.slice(0, -1), 10);
    const unit = expiresInStr.slice(-1);
    const date = new Date();

    if (unit === 'd') {
        date.setDate(date.getDate() + value);
    } else if (unit === 'm') {
        date.setMinutes(date.getMinutes() + value);
    }
    return date;
};

export const authService = {
    register: async (data, { userAgent, ipHash }) => {
        const passwordHash = await argon2.hash(data.password);

        const user = await userRepository.create({
            fullName: data.fullName,
            email: data.email,
            passwordHash,
            role: data.role,
        });

        const jti = tokenService.generateJti();
        const familyId = tokenService.generateFamilyId();
        const refreshToken = tokenService.generateRefreshToken(user, jti);
        const accessToken = tokenService.generateAccessToken(user);

        await refreshSessionRepository.create({
            userId: user._id,
            jti,
            familyId,
            tokenHash: tokenService.hashToken(refreshToken),
            expiresAt: getExpiresAt(env.JWT_REFRESH_EXPIRES_IN),
            userAgent,
            ipHash,
        });

        const userObj = user.toObject();
        delete userObj.passwordHash;

        return { user: userObj, accessToken, refreshToken };
    },

    login: async (email, password, { userAgent, ipHash }) => {
        const user = await userRepository.findByEmail(email);

        if (!user) {
            const err = new Error('Invalid email or password');
            err.code = ErrorCodes.INVALID_CREDENTIALS;
            err.statusCode = 401;
            throw err;
        }

        const isPasswordValid = await argon2.verify(user.passwordHash, password);

        if (!isPasswordValid) {
            const err = new Error('Invalid email or password');
            err.code = ErrorCodes.INVALID_CREDENTIALS;
            err.statusCode = 401;
            throw err;
        }

        if (!user.isActive) {
            const err = new Error('Account is inactive');
            err.code = ErrorCodes.ACCOUNT_INACTIVE;
            err.statusCode = 403;
            throw err;
        }

        const jti = tokenService.generateJti();
        const familyId = tokenService.generateFamilyId();
        const refreshToken = tokenService.generateRefreshToken(user, jti);
        const accessToken = tokenService.generateAccessToken(user);

        await refreshSessionRepository.create({
            userId: user._id,
            jti,
            familyId,
            tokenHash: tokenService.hashToken(refreshToken),
            expiresAt: getExpiresAt(env.JWT_REFRESH_EXPIRES_IN),
            userAgent,
            ipHash,
        });

        const userObj = user.toObject();
        delete userObj.passwordHash;

        return { user: userObj, accessToken, refreshToken };
    },

    rotate: async (oldRefreshToken, { userAgent, ipHash }) => {
        const decoded = tokenService.verifyRefreshToken(oldRefreshToken);

        const { jti, sub: userId } = decoded;

        const session = await mongoose.startSession();
        let result;

        try {
            await session.withTransaction(async () => {
                const sessionRecord = await refreshSessionRepository.findByJti(jti, { session });

                if (!sessionRecord) {
                    const err = new Error('Refresh token session not found');
                    err.code = ErrorCodes.INVALID_TOKEN;
                    err.statusCode = 401;
                    throw err;
                }

                if (
                    sessionRecord.revokedAt ||
                    sessionRecord.tokenHash !== tokenService.hashToken(oldRefreshToken)
                ) {
                    await refreshSessionRepository.revokeFamily(
                        sessionRecord.familyId,
                        'REPLAY_DETECTED',
                        { session },
                    );

                    const err = new Error('Refresh token reuse detected');
                    err.code = ErrorCodes.REFRESH_TOKEN_REUSED;
                    err.statusCode = 401;
                    throw err;
                }

                const user = await userRepository.findById(userId, { session });

                if (!user || !user.isActive) {
                    const err = new Error('User not found or inactive');
                    err.code = user ? ErrorCodes.ACCOUNT_INACTIVE : ErrorCodes.INVALID_TOKEN;
                    err.statusCode = 401;
                    throw err;
                }

                const newJti = tokenService.generateJti();
                const newRefreshToken = tokenService.generateRefreshToken(user, newJti);
                const newAccessToken = tokenService.generateAccessToken(user);

                const newSessionRecord = await refreshSessionRepository.create(
                    {
                        userId: user._id,
                        jti: newJti,
                        familyId: sessionRecord.familyId,
                        tokenHash: tokenService.hashToken(newRefreshToken),
                        expiresAt: getExpiresAt(env.JWT_REFRESH_EXPIRES_IN),
                        userAgent,
                        ipHash,
                    },
                    { session },
                );

                await refreshSessionRepository.revokeById(
                    sessionRecord._id,
                    'ROTATED',
                    newSessionRecord._id,
                    { session },
                );

                const userObj = user.toObject();
                delete userObj.passwordHash;

                result = {
                    user: userObj,
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                };
            });
        } finally {
            await session.endSession();
        }

        return result;
    },

    logout: async (refreshToken) => {
        try {
            const decoded = tokenService.verifyRefreshToken(refreshToken);
            const sessionRecord = await refreshSessionRepository.findByJti(decoded.jti);

            if (sessionRecord && !sessionRecord.revokedAt) {
                await refreshSessionRepository.revokeById(sessionRecord._id, 'LOGGED_OUT', null);
            }
        } catch {
            // Ignore errors during logout (e.g. invalid token or expired token)
        }
    },
};
