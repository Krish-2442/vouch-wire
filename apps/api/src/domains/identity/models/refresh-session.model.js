import mongoose from 'mongoose';

const refreshSessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'User',
        },
        jti: {
            type: String,
            required: true,
            unique: true,
        },
        familyId: {
            type: String,
            required: true,
        },
        tokenHash: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
        revokedReason: {
            type: String,
            default: null,
        },
        replacedBySessionId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        userAgent: {
            type: String,
            default: null,
        },
        ipHash: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    },
);

refreshSessionSchema.index({ userId: 1, familyId: 1 });
refreshSessionSchema.index({ familyId: 1, revokedAt: 1 });
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema);
