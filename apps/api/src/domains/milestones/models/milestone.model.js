import mongoose from 'mongoose';

const MILESTONE_STATUSES = ['DRAFT', 'FUNDED', 'SUBMITTED', 'APPROVED'];

const milestoneSchema = new mongoose.Schema(
    {
        agreementId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Agreement',
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 5000,
        },
        amountMinor: {
            type: Number,
            required: true,
            validate: {
                validator: (v) => Number.isSafeInteger(v) && v > 0,
                message: 'amountMinor must be a positive safe integer',
            },
        },
        sequence: {
            type: Number,
            required: true,
            validate: {
                validator: (v) => Number.isInteger(v) && v > 0,
                message: 'sequence must be a positive integer',
            },
        },
        dueDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            required: true,
            enum: MILESTONE_STATUSES,
            default: 'DRAFT',
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

milestoneSchema.index({ agreementId: 1, sequence: 1 }, { unique: true });
milestoneSchema.index({ agreementId: 1, status: 1, dueDate: 1 });

export const Milestone = mongoose.model('Milestone', milestoneSchema);
export { MILESTONE_STATUSES };
