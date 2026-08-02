import mongoose from 'mongoose';

const AGREEMENT_STATUSES = ['DRAFT', 'PROPOSED', 'ACTIVE', 'REJECTED', 'CANCELLED'];

const agreementSchema = new mongoose.Schema(
    {
        clientWorkspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
        },
        freelancerWorkspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160,
        },
        scope: {
            type: String,
            required: true,
            trim: true,
            maxlength: 10000,
        },
        currency: {
            type: String,
            required: true,
            match: /^[A-Z]{3}$/,
        },
        contractAmountMinor: {
            type: Number,
            required: true,
            validate: {
                validator: (v) => Number.isSafeInteger(v) && v > 0,
                message: 'contractAmountMinor must be a positive safe integer',
            },
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: AGREEMENT_STATUSES,
            default: 'DRAFT',
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        proposedAt: { type: Date },
        acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        acceptedAt: { type: Date },
        rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rejectedAt: { type: Date },
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        cancelledAt: { type: Date },
    },
    {
        timestamps: true,
    },
);

agreementSchema.index({ clientWorkspaceId: 1, status: 1, updatedAt: -1 });
agreementSchema.index({ freelancerWorkspaceId: 1, status: 1, updatedAt: -1 });
agreementSchema.index({ status: 1, endDate: 1 });

export const Agreement = mongoose.model('Agreement', agreementSchema);
export { AGREEMENT_STATUSES };
