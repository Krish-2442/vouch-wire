import mongoose from 'mongoose';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

const OPERATION_TYPES = ['WALLET_TOP_UP', 'MILESTONE_FUND'];
const ENTRY_SIDES = ['AVAILABLE_CREDIT', 'AVAILABLE_DEBIT', 'ESCROW_CREDIT'];

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
    { workspaceId: 1, operationType: 1, idempotencyKey: 1, entrySide: 1 },
    { unique: true },
);

ledgerEntrySchema.pre('save', function () {
    if (!this.isNew) {
        throw new AppError(ErrorCodes.LEDGER_IMMUTABLE, 405, 'Ledger entries are immutable and append-only.');
    }
});

const rejectModification = function () {
    throw new AppError(ErrorCodes.LEDGER_IMMUTABLE, 405, 'Ledger entries are immutable and append-only.');
};

ledgerEntrySchema.pre('updateOne', rejectModification);
ledgerEntrySchema.pre('updateMany', rejectModification);
ledgerEntrySchema.pre('findOneAndUpdate', rejectModification);
ledgerEntrySchema.pre('replaceOne', rejectModification);
ledgerEntrySchema.pre('deleteOne', rejectModification);
ledgerEntrySchema.pre('deleteMany', rejectModification);
ledgerEntrySchema.pre('findOneAndDelete', rejectModification);
ledgerEntrySchema.pre('findOneAndReplace', rejectModification);
ledgerEntrySchema.pre('findOneAndRemove', rejectModification);
ledgerEntrySchema.pre('findByIdAndDelete', rejectModification);
ledgerEntrySchema.pre('findByIdAndUpdate', rejectModification);

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
export { OPERATION_TYPES, ENTRY_SIDES };
