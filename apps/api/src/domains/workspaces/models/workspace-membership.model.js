import mongoose from 'mongoose';

const workspaceMembershipSchema = new mongoose.Schema(
    {
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        membershipRole: {
            type: String,
            required: true,
            enum: ['OWNER', 'MEMBER'],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    },
);

workspaceMembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
workspaceMembershipSchema.index({ userId: 1, isActive: 1, createdAt: -1 });
workspaceMembershipSchema.index({ workspaceId: 1, isActive: 1, membershipRole: 1 });

export const WorkspaceMembership = mongoose.model('WorkspaceMembership', workspaceMembershipSchema);
