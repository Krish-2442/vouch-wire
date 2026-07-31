import argon2 from 'argon2';
import mongoose from 'mongoose';
import { userRepository } from '../repositories/user.repository.js';
import { refreshSessionRepository } from '../repositories/refresh-session.repository.js';
import { tokenService } from './token.service.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';
import { AppError } from '../../../shared/errors/app-error.js';

export const authService = {
    register: async (data, { userAgent, ip }) => {
        const passwordHash = await argon2.hash(data.password);
        const session = await mongoose.startSession();
        const ipHash = ip ? tokenService.hashToken(ip) : null;
        let result;

        try {
            await session.withTransaction(async () => {
                const user = await userRepository.create(
                    {
                        fullName: data.fullName,
                        email: data.email,
                        passwordHash,
                        role: data.role,
                    },
                    { session },
                );

                const refreshJti = tokenService.generateJti();
                const accessJti = tokenService.generateJti();
                const familyId = tokenService.generateFamilyId();
                const refreshToken = tokenService.generateRefreshToken(user, refreshJti);
                const accessToken = tokenService.generateAccessToken(user, accessJti);

                await refreshSessionRepository.create(
                    {
                        userId: user._id,
                        jti: refreshJti,
                        familyId,
                        tokenHash: tokenService.hashToken(refreshToken),
                        expiresAt: tokenService.getRefreshExpiresAt(),
                        userAgent,
                        ipHash,
                    },
                    { session },
                );

                const userObj = user.toObject();
                delete userObj.passwordHash;

                result = { user: userObj, accessToken, refreshToken };
            });
        } finally {
            await session.endSession();
        }

        return result;
    },

    login: async (email, password, { userAgent, ip }) => {
        const user = await userRepository.findByEmail(email);
        const ipHash = ip ? tokenService.hashToken(ip) : null;

        if (!user) {
            throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
        }

        const isPasswordValid = await argon2.verify(user.passwordHash, password);

        if (!isPasswordValid) {
            throw new AppError(ErrorCodes.INVALID_CREDENTIALS, 401, 'Invalid email or password');
        }

        if (!user.isActive) {
            throw new AppError(ErrorCodes.ACCOUNT_INACTIVE, 403, 'Account is inactive');
        }

        const refreshJti = tokenService.generateJti();
        const accessJti = tokenService.generateJti();
        const familyId = tokenService.generateFamilyId();
        const refreshToken = tokenService.generateRefreshToken(user, refreshJti);
        const accessToken = tokenService.generateAccessToken(user, accessJti);

        await refreshSessionRepository.create({
            userId: user._id,
            jti: refreshJti,
            familyId,
            tokenHash: tokenService.hashToken(refreshToken),
            expiresAt: tokenService.getRefreshExpiresAt(),
            userAgent,
            ipHash,
        });

        const userObj = user.toObject();
        delete userObj.passwordHash;

        return { user: userObj, accessToken, refreshToken };
    },

    rotate: async (oldRefreshToken, { userAgent, ip }) => {
        const decoded = tokenService.verifyRefreshToken(oldRefreshToken);
        const ipHash = ip ? tokenService.hashToken(ip) : null;

        const { jti, sub: userId } = decoded;

        const session = await mongoose.startSession();
        let result;
        let replayError = null;

        try {
            await session.withTransaction(async () => {
                const sessionRecord = await refreshSessionRepository.findByJti(jti, { session });

                if (!sessionRecord) {
                    throw new AppError(
                        ErrorCodes.INVALID_TOKEN,
                        401,
                        'Refresh token session not found',
                    );
                }

                if (sessionRecord.userId.toString() !== userId) {
                    throw new AppError(
                        ErrorCodes.INVALID_TOKEN,
                        401,
                        'Refresh token session user mismatch',
                    );
                }

                if (
                    sessionRecord.revokedAt ||
                    !tokenService.verifyTokenHash(oldRefreshToken, sessionRecord.tokenHash)
                ) {
                    await refreshSessionRepository.revokeFamily(
                        sessionRecord.familyId,
                        'REPLAY_DETECTED',
                        { session },
                    );

                    replayError = new AppError(
                        ErrorCodes.REFRESH_TOKEN_REUSED,
                        401,
                        'Refresh token reuse detected',
                    );
                    return;
                }

                const user = await userRepository.findById(userId, { session });

                if (!user) {
                    throw new AppError(ErrorCodes.INVALID_TOKEN, 401, 'User not found');
                }

                if (!user.isActive) {
                    throw new AppError(ErrorCodes.ACCOUNT_INACTIVE, 403, 'Account is inactive');
                }

                const claimResult = await refreshSessionRepository.revokeById(
                    sessionRecord._id,
                    userId,
                    'ROTATED',
                    null,
                    { session },
                );

                if (claimResult.modifiedCount === 0) {
                    await refreshSessionRepository.revokeFamily(
                        sessionRecord.familyId,
                        'CONCURRENT_REPLAY',
                        { session },
                    );

                    replayError = new AppError(
                        ErrorCodes.REFRESH_TOKEN_REUSED,
                        401,
                        'Refresh token already rotated',
                    );
                    return;
                }

                const refreshJti = tokenService.generateJti();
                const accessJti = tokenService.generateJti();
                const newRefreshToken = tokenService.generateRefreshToken(user, refreshJti);
                const newAccessToken = tokenService.generateAccessToken(user, accessJti);

                const newSessionRecord = await refreshSessionRepository.create(
                    {
                        userId: user._id,
                        jti: refreshJti,
                        familyId: sessionRecord.familyId,
                        tokenHash: tokenService.hashToken(newRefreshToken),
                        expiresAt: tokenService.getRefreshExpiresAt(),
                        userAgent,
                        ipHash,
                    },
                    { session },
                );

                await refreshSessionRepository.updateReplacedBy(
                    sessionRecord._id,
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

        if (replayError) {
            throw replayError;
        }

        return result;
    },

    logout: async (refreshToken) => {
        let decoded;
        try {
            decoded = tokenService.verifyRefreshToken(refreshToken);
        } catch {
            return;
        }

        const { jti, sub: userId } = decoded;

        const sessionRecord = await refreshSessionRepository.findByJti(jti);

        if (!sessionRecord || sessionRecord.revokedAt) {
            return;
        }

        if (sessionRecord.userId.toString() !== userId) {
            return;
        }

        if (!tokenService.verifyTokenHash(refreshToken, sessionRecord.tokenHash)) {
            return;
        }

        await refreshSessionRepository.revokeById(sessionRecord._id, userId, 'LOGGED_OUT', null);
    },
};
