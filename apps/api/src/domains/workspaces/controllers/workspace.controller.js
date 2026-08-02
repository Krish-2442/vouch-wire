import { workspaceService } from '../services/workspace.service.js';
import { workspaceMembershipService } from '../services/workspace-membership.service.js';
import { asyncHandler } from '../../../shared/utils/async-handler.js';
import { successResponse } from '../../../shared/utils/api-response.js';

export const workspaceController = {
    createWorkspace: asyncHandler(async (req, res) => {
        const { name } = req.body;
        const workspaceType = req.auth.role;
        const createdBy = req.auth.userId;

        const result = await workspaceService.createWorkspace({
            name,
            workspaceType,
            createdBy,
        });

        return successResponse(res, { data: result, statusCode: 201 });
    }),

    getWorkspaces: asyncHandler(async (req, res) => {
        const userId = req.auth.userId;
        const { page, limit } = req.query;

        const workspaces = await workspaceService.getWorkspacesForUser({
            userId,
            page,
            limit,
        });

        return successResponse(res, { data: workspaces, statusCode: 200 });
    }),

    getWorkspaceById: asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;

        const workspace = await workspaceService.getWorkspaceById({ workspaceId });

        return successResponse(res, { data: workspace, statusCode: 200 });
    }),

    updateWorkspace: asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        const { name } = req.body;

        const updatedWorkspace = await workspaceService.updateWorkspaceName({
            workspaceId,
            name,
        });

        return successResponse(res, { data: updatedWorkspace, statusCode: 200 });
    }),

    addMember: asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        const { email } = req.body;
        const addedByUserId = req.auth.userId;

        const newMembership = await workspaceMembershipService.addMember({
            workspaceId,
            email,
            addedByUserId,
        });

        return successResponse(res, { data: newMembership, statusCode: 201 });
    }),

    getMembers: asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        const { page, limit } = req.query;

        const members = await workspaceMembershipService.getWorkspaceMembers({
            workspaceId,
            page,
            limit,
        });

        return successResponse(res, { data: members, statusCode: 200 });
    }),

    removeMember: asyncHandler(async (req, res) => {
        const { workspaceId, membershipId } = req.params;

        await workspaceMembershipService.removeMember({
            workspaceId,
            membershipId,
        });

        res.status(204).send();
    }),
};
