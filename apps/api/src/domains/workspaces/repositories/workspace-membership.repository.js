import { WorkspaceMembership } from '../models/workspace-membership.model.js';

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

    updateById: async (id, data, session = null) => {
        const query = WorkspaceMembership.findByIdAndUpdate(id, data, { new: true });
        if (session) {
            query.session(session);
        }
        return query.exec();
    },

    findActiveByUserIdWithWorkspaces: async (userId, { skip = 0, limit = 10 } = {}) => {
        const memberships = await WorkspaceMembership.find({ userId, isActive: true })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('workspaceId', '_id name slug workspaceType isActive')
            .lean();

        return memberships
            .filter((m) => m.workspaceId && m.workspaceId.isActive)
            .map((m) => ({
                membershipId: m._id,
                membershipRole: m.membershipRole,
                joinedAt: m.createdAt,
                workspace: {
                    id: m.workspaceId._id,
                    name: m.workspaceId.name,
                    slug: m.workspaceId.slug,
                    workspaceType: m.workspaceId.workspaceType,
                    isActive: m.workspaceId.isActive,
                },
            }));
    },

    findActiveMembersByWorkspaceId: async (workspaceId, { skip = 0, limit = 10 } = {}) => {
        const memberships = await WorkspaceMembership.find({ workspaceId, isActive: true })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', '_id fullName email isActive')
            .lean();

        return memberships.map((m) => ({
            _id: m._id,
            membershipRole: m.membershipRole,
            isActive: m.isActive,
            createdAt: m.createdAt,
            user: {
                id: m.userId._id,
                fullName: m.userId.fullName,
                email: m.userId.email,
                isActive: m.userId.isActive,
            },
        }));
    },
};
