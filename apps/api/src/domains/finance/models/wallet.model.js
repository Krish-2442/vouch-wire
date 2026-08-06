import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
    {
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
        },
        currency: {
            type: String,
            required: true,
            match: /^[A-Z]{3}$/,
        },
        availableAmountMinor: {
            type: Number,
            required: true,
            default: 0,
            validate: {
                validator: (v) => Number.isSafeInteger(v) && v >= 0,
                message: 'availableAmountMinor must be a non-negative safe integer',
            },
        },
        escrowedAmountMinor: {
            type: Number,
            required: true,
            default: 0,
            validate: {
                validator: (v) => Number.isSafeInteger(v) && v >= 0,
                message: 'escrowedAmountMinor must be a non-negative safe integer',
            },
        },
    },
    {
        timestamps: true,
    },
);

walletSchema.index({ workspaceId: 1, currency: 1 }, { unique: true });

export const Wallet = mongoose.model('Wallet', walletSchema);
