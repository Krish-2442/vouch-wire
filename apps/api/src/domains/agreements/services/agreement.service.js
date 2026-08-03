import { agreementRepository } from '../repositories/agreement.repository.js';
import { workspaceService } from '../../workspaces/services/workspace.service.js';
import { workspaceMembershipService } from '../../workspaces/services/workspace-membership.service.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

const VALID_TRANSITIONS = {
    DRAFT: ['PROPOSED', 'CANCELLED'],
    PROPOSED: ['ACTIVE', 'REJECTED', 'CANCELLED'],
};

const assertOwnership = async (workspaceId, userId) => {
    const access = await workspaceMembershipService.checkAccess({ workspaceId, userId });

    if (!access || access.membershipRole !== 'OWNER') {
        throw new AppError(
            ErrorCodes.AGREEMENT_ACCESS_DENIED,
            403,
            'Workspace owner access required',
        );
    }

    return access;
};

const assertMembership = async (workspaceId, userId) => {
    const access = await workspaceMembershipService.checkAccess({ workspaceId, userId });
    return !!access;
};

const assertParticipant = async (agreement, userId) => {
    const isClient = await assertMembership(agreement.clientWorkspaceId, userId);
    const isFreelancer = await assertMembership(agreement.freelancerWorkspaceId, userId);

    if (!isClient && !isFreelancer) {
        throw new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found');
    }

    return { isClient, isFreelancer };
};

const validateTransition = (currentStatus, targetStatus) => {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
        throw new AppError(
            ErrorCodes.INVALID_AGREEMENT_TRANSITION,
            409,
            `Cannot transition from ${currentStatus} to ${targetStatus}`,
        );
    }
};

const assertAtomicTransition = (result, currentStatus, targetStatus) => {
    if (!result) {
        throw new AppError(
            ErrorCodes.INVALID_AGREEMENT_TRANSITION,
            409,
            `Cannot transition from ${currentStatus} to ${targetStatus}`,
        );
    }
};

export const agreementService = {
    createAgreement: async ({ body, userId }) => {
        const {
            clientWorkspaceId,
            freelancerWorkspaceId,
            title,
            scope,
            currency,
            contractAmountMinor,
            startDate,
            endDate,
        } = body;

        if (clientWorkspaceId === freelancerWorkspaceId) {
            throw new AppError(
                ErrorCodes.INVALID_AGREEMENT_PARTICIPANTS,
                400,
                'Client and freelancer workspaces must be different',
            );
        }

        await assertOwnership(clientWorkspaceId, userId);

        const clientWorkspace = await workspaceService.getWorkspaceById({
            workspaceId: clientWorkspaceId,
        });
        if (clientWorkspace.workspaceType !== 'CLIENT') {
            throw new AppError(
                ErrorCodes.INVALID_AGREEMENT_PARTICIPANTS,
                400,
                'Client workspace must have type CLIENT',
            );
        }

        const freelancerWorkspace = await workspaceService.getWorkspaceById({
            workspaceId: freelancerWorkspaceId,
        });
        if (freelancerWorkspace.workspaceType !== 'FREELANCER') {
            throw new AppError(
                ErrorCodes.INVALID_AGREEMENT_PARTICIPANTS,
                400,
                'Freelancer workspace must have type FREELANCER',
            );
        }

        return agreementRepository.create({
            clientWorkspaceId,
            freelancerWorkspaceId,
            title,
            scope,
            currency,
            contractAmountMinor,
            startDate,
            endDate,
            status: 'DRAFT',
            createdBy: userId,
        });
    },

    getAgreement: async ({ agreementId, userId }) => {
        const agreement = await agreementRepository.findById(agreementId);
        if (!agreement) {
            throw new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found');
        }

        await assertParticipant(agreement, userId);

        return agreement;
    },

    listAgreements: async ({ workspaceId, userId, page = 1, limit = 10 }) => {
        const isMember = await assertMembership(workspaceId, userId);
        if (!isMember) {
            throw new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found');
        }

        const skip = (page - 1) * limit;
        return agreementRepository.findByWorkspaceId(workspaceId, { skip, limit });
    },

    updateAgreement: async ({ agreementId, userId, updates }) => {
        const agreement = await agreementRepository.findById(agreementId);
        if (!agreement) {
            throw new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found');
        }

        await assertOwnership(agreement.clientWorkspaceId, userId);

        const effectiveStart = updates.startDate || agreement.startDate;
        const effectiveEnd = updates.endDate || agreement.endDate;
        if (new Date(effectiveEnd) < new Date(effectiveStart)) {
            throw new AppError(
                ErrorCodes.VALIDATION_ERROR,
                400,
                'endDate must not be earlier than startDate',
            );
        }

        const result = await agreementRepository.updateDraft(agreementId, updates);
        if (!result) {
            throw new AppError(
                ErrorCodes.INVALID_AGREEMENT_TRANSITION,
                409,
                'Agreement can only be edited in DRAFT status',
            );
        }

        return result;
    },

    proposeAgreement: async ({ agreementId, userId }) => {
        const agreement = await agreementRepository.findById(agreementId);
        if (!agreement) {
            throw new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found');
        }

        validateTransition(agreement.status, 'PROPOSED');
        await assertOwnership(agreement.clientWorkspaceId, userId);

        const result = await agreementRepository.updateAgreementStatus(
            agreementId,
            agreement.status,
            'PROPOSED',
            { proposedBy: userId, proposedAt: new Date() },
        );

        assertAtomicTransition(result, agreement.status, 'PROPOSED');
        return result;
    },

    acceptAgreement: async ({ agreementId, userId }) => {
        const agreement = await agreementRepository.findById(agreementId);
        if (!agreement) {
            throw new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found');
        }

        validateTransition(agreement.status, 'ACTIVE');
        await assertOwnership(agreement.freelancerWorkspaceId, userId);

        const result = await agreementRepository.updateAgreementStatus(
            agreementId,
            agreement.status,
            'ACTIVE',
            { acceptedBy: userId, acceptedAt: new Date() },
        );

        assertAtomicTransition(result, agreement.status, 'ACTIVE');
        return result;
    },

    rejectAgreement: async ({ agreementId, userId }) => {
        const agreement = await agreementRepository.findById(agreementId);
        if (!agreement) {
            throw new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found');
        }

        validateTransition(agreement.status, 'REJECTED');
        await assertOwnership(agreement.freelancerWorkspaceId, userId);

        const result = await agreementRepository.updateAgreementStatus(
            agreementId,
            agreement.status,
            'REJECTED',
            { rejectedBy: userId, rejectedAt: new Date() },
        );

        assertAtomicTransition(result, agreement.status, 'REJECTED');
        return result;
    },

    cancelAgreement: async ({ agreementId, userId }) => {
        const agreement = await agreementRepository.findById(agreementId);
        if (!agreement) {
            throw new AppError(ErrorCodes.AGREEMENT_NOT_FOUND, 404, 'Agreement not found');
        }

        validateTransition(agreement.status, 'CANCELLED');
        await assertOwnership(agreement.clientWorkspaceId, userId);

        const result = await agreementRepository.updateAgreementStatus(
            agreementId,
            agreement.status,
            'CANCELLED',
            { cancelledBy: userId, cancelledAt: new Date() },
        );

        assertAtomicTransition(result, agreement.status, 'CANCELLED');
        return result;
    },
};
