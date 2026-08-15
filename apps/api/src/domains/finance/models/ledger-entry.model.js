import mongoose from 'mongoose';

const OPERATION_TYPES = ['WALLET_TOP_UP', 'MILESTONE_FUND', 'ESCROW_RELEASE'];
const ENTRY_SIDES = ['AVAILABLE_CREDIT', 'AVAILABLE_DEBIT', 'ESCROW_CREDIT', 'ESCROW_DEBIT'];

const ledgerEntrySchema = new mongoose.Schema(
    {
        walletId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Wallet',
            required: true,
        },
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
        },
        idempotencyScopeWorkspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
        },
        milestoneId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Milestone',
        },
        currency: {
            type: String,
            required: true,
            match: /^[A-Z]{3}$/,
        },
        operationId: {
            type: String,
            required: true,
        },
        operationType: {
            type: String,
            required: true,
            enum: OPERATION_TYPES,
        },
        entrySide: {
            type: String,
            required: true,
            enum: ENTRY_SIDES,
        },
        amountMinor: {
            type: Number,
            required: true,
            validate: {
                validator: (v) => Number.isSafeInteger(v) && v > 0,
                message: 'amountMinor must be a positive safe integer',
            },
        },
        availableAmountAfterMinor: {
            type: Number,
            required: true,
            validate: {
                validator: (v) => Number.isSafeInteger(v) && v >= 0,
                message: 'availableAmountAfterMinor must be a non-negative safe integer',
            },
        },
        escrowedAmountAfterMinor: {
            type: Number,
            required: true,
            validate: {
                validator: (v) => Number.isSafeInteger(v) && v >= 0,
                message: 'escrowedAmountAfterMinor must be a non-negative safe integer',
            },
        },
        idempotencyKey: {
            type: String,
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

ledgerEntrySchema.index({ walletId: 1, createdAt: -1 });
ledgerEntrySchema.index({ milestoneId: 1, operationType: 1 });
ledgerEntrySchema.index(
    { idempotencyScopeWorkspaceId: 1, operationType: 1, idempotencyKey: 1, entrySide: 1 },
    { unique: true },
);

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
export { OPERATION_TYPES, ENTRY_SIDES };
