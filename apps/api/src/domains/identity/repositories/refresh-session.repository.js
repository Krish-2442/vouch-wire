import { RefreshSession } from '../models/refresh-session.model.js';

export const refreshSessionRepository = {
    create: async (sessionData, options = {}) => {
        const [session] = await RefreshSession.create([sessionData], options);
        return session;
    },

    findByJti: async (jti, options = {}) => {
        return RefreshSession.findOne({ jti }, null, options);
    },

    revokeFamily: async (familyId, reason, options = {}) => {
        return RefreshSession.updateMany(
            { familyId, revokedAt: null },
            {
                $set: {
                    revokedAt: new Date(),
                    revokedReason: reason,
                },
            },
            options,
        );
    },

    revokeById: async (sessionId, userId, reason, replacedBySessionId, options = {}) => {
        return RefreshSession.updateOne(
            { _id: sessionId, userId, revokedAt: null },
            {
                $set: {
                    revokedAt: new Date(),
                    revokedReason: reason,
                    replacedBySessionId,
                },
            },
            options,
        );
    },

    updateReplacedBy: async (sessionId, replacedBySessionId, options = {}) => {
        return RefreshSession.updateOne(
            { _id: sessionId },
            {
                $set: { replacedBySessionId },
            },
            options,
        );
    },
};
