import { workspaceService } from '../services/workspace.service.js';
import { workspaceMembershipService } from '../services/workspace-membership.service.js';
import { successResponse } from '../../../shared/utils/api-response.js';

export const workspaceController = {
    createWorkspace: async (req, res) => {
        const { name } = req.validated.body;
        const workspaceType = req.auth.role;
        const createdBy = req.auth.userId;

        const result = await workspaceService.createWorkspace({
            name,
            workspaceType,
            createdBy,
        });

        return successResponse(res, { data: result, statusCode: 201 });
    },

    getWorkspaces: async (req, res) => {
        const userId = req.auth.userId;
        const { page, limit } = req.validated.query;

        const workspaces = await workspaceService.getWorkspacesForUser({
            userId,
            page,
            limit,
        });

        return successResponse(res, { data: workspaces, statusCode: 200 });
    },

    getWorkspaceById: async (req, res) => {
        const { workspaceId } = req.validated.params;

        const workspace = await workspaceService.getWorkspaceById({ workspaceId });

        return successResponse(res, { data: workspace, statusCode: 200 });
    },

    updateWorkspace: async (req, res) => {
        const { workspaceId } = req.validated.params;
        const { name } = req.validated.body;

        const updatedWorkspace = await workspaceService.updateWorkspaceName({
            workspaceId,
            name,
        });

        return successResponse(res, { data: updatedWorkspace, statusCode: 200 });
    },

    addMember: async (req, res) => {
        const { workspaceId } = req.validated.params;
        const { email } = req.validated.body;
        const addedByUserId = req.auth.userId;

        const newMembership = await workspaceMembershipService.addMember({
            workspaceId,
            email,
            addedByUserId,
        });

        return successResponse(res, { data: newMembership, statusCode: 201 });
    },

    getMembers: async (req, res) => {
        const { workspaceId } = req.validated.params;
        const { page, limit } = req.validated.query;

        const members = await workspaceMembershipService.getWorkspaceMembers({
            workspaceId,
            page,
            limit,
        });

        return successResponse(res, { data: members, statusCode: 200 });
    },

    removeMember: async (req, res) => {
        const { workspaceId, membershipId } = req.validated.params;

        await workspaceMembershipService.removeMember({
            workspaceId,
            membershipId,
        });

        res.status(204).send();
    },
};
