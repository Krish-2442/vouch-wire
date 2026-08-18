import mongoose from 'mongoose';
import { workSubmissionRepository } from '../repositories/work-submission.repository.js';
import { milestoneService } from '../../milestones/services/milestone.service.js';
import { agreementService } from '../../agreements/services/agreement.service.js';
import { workspaceMembershipService } from '../../workspaces/services/workspace-membership.service.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

const verifyAgreementAccess = async (agreementId, userId) => {
    try {
        return await agreementService.getAgreement({ agreementId, userId });
    } catch (error) {
        if (error.code === ErrorCodes.AGREEMENT_NOT_FOUND) {
            throw new AppError(ErrorCodes.MILESTONE_NOT_FOUND, 404, 'Milestone not found');
        }
        throw error;
    }
};

const assertFreelancerMember = async (agreement, userId) => {
    const access = await workspaceMembershipService.checkAccess({
        workspaceId: agreement.freelancerWorkspaceId,
        userId,
    });

    if (!access) {
        throw new AppError(
            ErrorCodes.FORBIDDEN,
            403,
            'Only FREELANCER workspace members can submit work',
        );
    }
};

export const submissionService = {
    submitWork: async ({ milestoneId, userId, summary, evidenceUrl }) => {
        const milestone = await milestoneService.getMilestone({ milestoneId, userId });
        const agreement = await verifyAgreementAccess(milestone.agreementId, userId);

        if (agreement.status !== 'ACTIVE') {
            throw new AppError(
                ErrorCodes.AGREEMENT_NOT_ACTIVE,
                409,
                'Cannot submit work for an inactive agreement',
            );
        }

        await assertFreelancerMember(agreement, userId);

        if (milestone.status !== 'FUNDED') {
            throw new AppError(
                ErrorCodes.INVALID_SUBMISSION_STATE,
                409,
                'Milestone must be in FUNDED state to submit work',
            );
        }

        const existing = await workSubmissionRepository.findByMilestoneId(milestoneId);
        if (existing) {
            throw new AppError(
                ErrorCodes.SUBMISSION_ALREADY_EXISTS,
                409,
                'A submission already exists for this milestone',
            );
        }

        const session = await mongoose.startSession();
        let submission;

        try {
            await session.withTransaction(async () => {
                const submittedAt = new Date();

                submission = await workSubmissionRepository.create(
                    {
                        milestoneId,
                        summary,
                        evidenceUrl,
                        submittedBy: userId,
                        submittedAt,
                    },
                    session,
                );

                await milestoneService.markAsSubmitted({
                    milestoneId,
                    submittedBy: userId,
                    submittedAt,
                    session,
                });
            });
        } catch (error) {
            if (error.code === 11000 || (error.message && error.message.includes('E11000'))) {
                throw new AppError(
                    ErrorCodes.SUBMISSION_ALREADY_EXISTS,
                    409,
                    'A submission already exists for this milestone',
                );
            }
            throw error;
        } finally {
            await session.endSession();
        }

        return submission;
    },

    getSubmission: async ({ milestoneId, userId }) => {
        const milestone = await milestoneService.getMilestone({ milestoneId, userId });
        await verifyAgreementAccess(milestone.agreementId, userId);

        const submission = await workSubmissionRepository.findByMilestoneId(milestoneId);
        if (!submission) {
            throw new AppError(ErrorCodes.NOT_FOUND, 404, 'Submission not found');
        }

        return submission;
    },
};
