import mongoose from 'mongoose';

const workSubmissionSchema = new mongoose.Schema(
    {
        milestoneId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Milestone',
            required: true,
            unique: true,
        },
        summary: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 5000,
        },
        evidenceUrl: {
            type: String,
            trim: true,
            maxlength: 2048,
        },
        submittedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        submittedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        approvedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    },
);

workSubmissionSchema.index({ submittedBy: 1, createdAt: -1 });

export const WorkSubmission = mongoose.model('WorkSubmission', workSubmissionSchema);
