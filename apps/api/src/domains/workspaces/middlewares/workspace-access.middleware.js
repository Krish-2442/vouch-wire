import { workspaceMembershipService } from '../services/workspace-membership.service.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

export const workspaceAccess =
    (allowedRoles = []) =>
    async (req, _res, next) => {
        const workspaceId = req.validated.params.workspaceId;
        const userId = req.auth.userId;

        const access = await workspaceMembershipService.checkAccess({ workspaceId, userId });

        if (!access) {
            return next(new AppError(ErrorCodes.WORKSPACE_NOT_FOUND, 404, 'Workspace not found'));
        }

        if (allowedRoles.length > 0 && !allowedRoles.includes(access.membershipRole)) {
            return next(new AppError(ErrorCodes.WORKSPACE_ACCESS_DENIED, 403, 'Access denied'));
        }

        next();
    };
