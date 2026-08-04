import { milestoneRepository } from '../repositories/milestone.repository.js';
import { agreementService } from '../../agreements/services/agreement.service.js';
import { workspaceMembershipService } from '../../workspaces/services/workspace-membership.service.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

const verifyAgreementAccess = async (agreementId, userId, isReadingMilestone = false) => {
    try {
        return await agreementService.getAgreement({ agreementId, userId });
    } catch (error) {
        if (isReadingMilestone && error.code === ErrorCodes.AGREEMENT_NOT_FOUND) {
            throw new AppError(ErrorCodes.MILESTONE_NOT_FOUND, 404, 'Milestone not found');
        }
        throw error;
    }
};

const assertClientOwner = async (agreement, userId) => {
    const access = await workspaceMembershipService.checkAccess({
        workspaceId: agreement.clientWorkspaceId,
        userId,
    });

    if (!access || access.membershipRole !== 'OWNER') {
        throw new AppError(
            ErrorCodes.MILESTONE_ACCESS_DENIED,
            403,
            'Only CLIENT workspace OWNER can manage milestones',
        );
    }
};

const assertAgreementActive = (agreement) => {
    if (agreement.status !== 'ACTIVE') {
        throw new AppError(
            ErrorCodes.AGREEMENT_NOT_ACTIVE,
            409,
            'Milestones can only be managed on ACTIVE agreements',
        );
    }
};

const validateDueDate = (dueDate, agreement) => {
    const date = new Date(dueDate);
    if (date < new Date(agreement.startDate) || date > new Date(agreement.endDate)) {
        throw new AppError(
            ErrorCodes.VALIDATION_ERROR,
            400,
            'Milestone due date must fall within the agreement start and end dates',
        );
    }
};

const handleMongoError = (error) => {
    if (error.name === 'MongoServerError' && error.code === 11000) {
        throw new AppError(
            ErrorCodes.CONFLICT,
            409,
            'Milestone sequence number must be unique within the agreement',
        );
    }
    throw error;
};

export const milestoneService = {
    createMilestone: async ({ agreementId, body, userId }) => {
        const agreement = await verifyAgreementAccess(agreementId, userId);
        assertAgreementActive(agreement);
        await assertClientOwner(agreement, userId);

        validateDueDate(body.dueDate, agreement);

        try {
            return await milestoneRepository.create({
                ...body,
                agreementId,
                createdBy: userId,
            });
        } catch (error) {
            handleMongoError(error);
        }
    },

    getMilestone: async ({ milestoneId, userId }) => {
        const milestone = await milestoneRepository.findById(milestoneId);
        if (!milestone) {
            throw new AppError(ErrorCodes.MILESTONE_NOT_FOUND, 404, 'Milestone not found');
        }

        await verifyAgreementAccess(milestone.agreementId, userId, true);

        return milestone;
    },

    listMilestones: async ({ agreementId, userId, page = 1, limit = 10 }) => {
        await verifyAgreementAccess(agreementId, userId, true);
        const skip = (page - 1) * limit;
        return milestoneRepository.findByAgreementId(agreementId, { skip, limit });
    },

    updateMilestone: async ({ milestoneId, userId, updates }) => {
        const milestone = await milestoneRepository.findById(milestoneId);
        if (!milestone) {
            throw new AppError(ErrorCodes.MILESTONE_NOT_FOUND, 404, 'Milestone not found');
        }

        const agreement = await verifyAgreementAccess(milestone.agreementId, userId);
        assertAgreementActive(agreement);
        await assertClientOwner(agreement, userId);

        if (updates.dueDate) {
            validateDueDate(updates.dueDate, agreement);
        }

        try {
            const updated = await milestoneRepository.updateDraft(milestoneId, updates);
            if (!updated) {
                throw new AppError(
                    ErrorCodes.MILESTONE_NOT_EDITABLE,
                    409,
                    'Milestone can only be edited in DRAFT status',
                );
            }
            return updated;
        } catch (error) {
            handleMongoError(error);
        }
    },

    deleteMilestone: async ({ milestoneId, userId }) => {
        const milestone = await milestoneRepository.findById(milestoneId);
        if (!milestone) {
            throw new AppError(ErrorCodes.MILESTONE_NOT_FOUND, 404, 'Milestone not found');
        }

        const agreement = await verifyAgreementAccess(milestone.agreementId, userId);
        assertAgreementActive(agreement);
        await assertClientOwner(agreement, userId);

        const deleted = await milestoneRepository.deleteDraft(milestoneId);
        if (!deleted) {
            throw new AppError(
                ErrorCodes.MILESTONE_NOT_EDITABLE,
                409,
                'Milestone can only be deleted in DRAFT status',
            );
        }
    },
};
