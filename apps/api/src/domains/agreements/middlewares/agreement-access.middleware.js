import { agreementRepository } from '../repositories/agreement.repository.js';
import { workspaceMembershipService } from '../../workspaces/services/workspace-membership.service.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';
import { asyncHandler } from '../../../shared/utils/async-handler.js';

export const agreementAccess = () =>
    asyncHandler(async (req, _res, next) => {
        const { agreementId } = req.params;
        const userId = req.auth.userId;

        const agreement = await agreementRepository.findById(agreementId);
        if (!agreement) {
            return next(new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found'));
        }

        const isClient = await workspaceMembershipService.checkAccess({
            workspaceId: agreement.clientWorkspaceId,
            userId,
        });
        const isFreelancer = await workspaceMembershipService.checkAccess({
            workspaceId: agreement.freelancerWorkspaceId,
            userId,
        });

        if (!isClient && !isFreelancer) {
            return next(new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found'));
        }

        req.agreement = agreement;
        req.agreementAccess = { isClient: !!isClient, isFreelancer: !!isFreelancer };
        next();
    });
