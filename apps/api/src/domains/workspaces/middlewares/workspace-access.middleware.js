import { workspaceMembershipRepository } from '../repositories/workspace-membership.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';
import { asyncHandler } from '../../../shared/utils/async-handler.js';

export const workspaceAccess = (allowedRoles = []) =>
    asyncHandler(async (req, res, next) => {
        const workspaceId = req.params.workspaceId;
        const userId = req.auth.userId;

        if (!workspaceId) {
            return next(
                new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'workspaceId parameter is required'),
            );
        }

        const membership = await workspaceMembershipRepository.findActiveByWorkspaceAndUser(
            workspaceId,
            userId,
        );

        if (!membership) {
            return next(new AppError(ErrorCodes.WORKSPACE_NOT_FOUND, 404, 'Workspace not found'));
        }

        if (allowedRoles && allowedRoles.length > 0) {
            if (!allowedRoles.includes(membership.membershipRole)) {
                return next(new AppError(ErrorCodes.WORKSPACE_ACCESS_DENIED, 403, 'Access denied'));
            }
        }

        req.workspaceAccess = {
            membershipRole: membership.membershipRole,
            workspaceId: membership.workspaceId,
        };

        next();
    });
