import { WorkspaceMembership } from '../models/workspace-membership.model.js';
import mongoose from 'mongoose';

export const workspaceMembershipRepository = {
    create: async (data, session) => {
        const [membership] = await WorkspaceMembership.create([data], { session });
        return membership;
    },

    findById: async (id, session = null) => {
        const query = WorkspaceMembership.findById(id);
        if (session) {
            query.session(session);
        }
        return query.exec();
    },

    findActiveByWorkspaceAndUser: async (workspaceId, userId, session = null) => {
        const query = WorkspaceMembership.findOne({
            workspaceId,
            userId,
            isActive: true,
        });
        if (session) {
            query.session(session);
        }
        return query.exec();
    },

    findActiveByWorkspaceAndEmail: async (workspaceId, email) => {
        const result = await WorkspaceMembership.aggregate([
            {
                $match: {
                    workspaceId: new mongoose.Types.ObjectId(workspaceId),
                    isActive: true,
                },
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $unwind: '$user',
            },
            {
                $match: {
                    'user.email': email,
                },
            },
        ]);
        return result[0] || null;
    },

    updateById: async (id, data, session = null) => {
        const query = WorkspaceMembership.findByIdAndUpdate(id, data, { new: true });
        if (session) {
            query.session(session);
        }
        return query.exec();
    },

    findActiveByUserIdWithWorkspaces: async (userId, { skip = 0, limit = 10 } = {}) => {
        return WorkspaceMembership.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    isActive: true,
                },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $skip: skip,
            },
            {
                $limit: limit,
            },
            {
                $lookup: {
                    from: 'workspaces',
                    localField: 'workspaceId',
                    foreignField: '_id',
                    as: 'workspace',
                },
            },
            {
                $unwind: '$workspace',
            },
            {
                $match: {
                    'workspace.isActive': true,
                },
            },
            {
                $project: {
                    _id: 0,
                    membershipId: '$_id',
                    membershipRole: 1,
                    joinedAt: '$createdAt',
                    workspace: {
                        id: '$workspace._id',
                        name: '$workspace.name',
                        slug: '$workspace.slug',
                        workspaceType: '$workspace.workspaceType',
                        isActive: '$workspace.isActive',
                    },
                },
            },
        ]);
    },

    findActiveMembersByWorkspaceId: async (workspaceId, { skip = 0, limit = 10 } = {}) => {
        return WorkspaceMembership.aggregate([
            {
                $match: {
                    workspaceId: new mongoose.Types.ObjectId(workspaceId),
                    isActive: true,
                },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $skip: skip,
            },
            {
                $limit: limit,
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $unwind: '$user',
            },
            {
                $project: {
                    _id: 1,
                    membershipRole: 1,
                    isActive: 1,
                    createdAt: 1,
                    user: {
                        id: '$user._id',
                        fullName: '$user.fullName',
                        email: '$user.email',
                        isActive: '$user.isActive',
                    },
                },
            },
        ]);
    },
};
