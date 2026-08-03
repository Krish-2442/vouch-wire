import { workspaceMembershipRepository } from '../repositories/workspace-membership.repository.js';
import { workspaceRepository } from '../repositories/workspace.repository.js';
import { userRepository } from '../../identity/repositories/user.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

export const workspaceMembershipService = {
    checkAccess: async ({ workspaceId, userId }) => {
        const membership = await workspaceMembershipRepository.findActiveByWorkspaceAndUser(
            workspaceId,
            userId,
        );

        if (!membership) {
            return null;
        }

        return {
            membershipRole: membership.membershipRole,
            workspaceId: membership.workspaceId,
        };
    },

    getWorkspaceMembers: async ({ workspaceId, page = 1, limit = 10 }) => {
        const skip = (page - 1) * limit;
        return workspaceMembershipRepository.findActiveMembersByWorkspaceId(workspaceId, {
            skip,
            limit,
        });
    },

    addMember: async ({ workspaceId, email, addedByUserId }) => {
        const workspace = await workspaceRepository.findById(workspaceId);
        if (!workspace || !workspace.isActive) {
            throw new AppError(ErrorCodes.WORKSPACE_NOT_FOUND, 404, 'Workspace not found');
        }

        const userToAdd = await userRepository.findByEmail(email);
        if (!userToAdd || !userToAdd.isActive) {
            throw new AppError(ErrorCodes.NOT_FOUND, 404, 'User not found');
        }

        if (userToAdd.role !== workspace.workspaceType) {
            throw new AppError(
                ErrorCodes.MEMBER_NOT_ELIGIBLE,
                400,
                `User role must match workspace type (${workspace.workspaceType})`,
            );
        }

        const existingMembership = await workspaceMembershipRepository.findActiveByWorkspaceAndUser(
            workspaceId,
            userToAdd._id,
        );

        if (existingMembership) {
            throw new AppError(
                ErrorCodes.MEMBER_ALREADY_EXISTS,
                409,
                'User is already a member of this workspace',
            );
        }

        const newMembership = await workspaceMembershipRepository.create({
            workspaceId,
            userId: userToAdd._id,
            membershipRole: 'MEMBER',
            createdBy: addedByUserId,
        });

        return newMembership;
    },

    removeMember: async ({ workspaceId, membershipId }) => {
        const membership = await workspaceMembershipRepository.findById(membershipId);

        if (
            !membership ||
            membership.workspaceId.toString() !== workspaceId.toString() ||
            !membership.isActive
        ) {
            throw new AppError(ErrorCodes.MEMBERSHIP_NOT_FOUND, 404, 'Membership not found');
        }

        if (membership.membershipRole === 'OWNER') {
            throw new AppError(
                ErrorCodes.OWNER_MEMBERSHIP_PROTECTED,
                400,
                'Cannot remove an OWNER from the workspace',
            );
        }

        await workspaceMembershipRepository.updateById(membershipId, { isActive: false });
    },
};
