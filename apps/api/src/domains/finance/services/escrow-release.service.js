import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { walletRepository } from '../repositories/wallet.repository.js';
import { ledgerEntryRepository } from '../repositories/ledger-entry.repository.js';
import { workSubmissionRepository } from '../../submissions/repositories/work-submission.repository.js';
import { agreementService } from '../../agreements/services/agreement.service.js';
import { milestoneService } from '../../milestones/services/milestone.service.js';
import { submissionService } from '../../submissions/services/submission.service.js';
import { workspaceMembershipService } from '../../workspaces/services/workspace-membership.service.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

const assertClientOwnerOfAgreement = async (agreement, userId) => {
    const access = await workspaceMembershipService.checkAccess({
        workspaceId: agreement.clientWorkspaceId,
        userId,
    });

    if (!access || access.membershipRole !== 'OWNER') {
        throw new AppError(
            ErrorCodes.FORBIDDEN,
            403,
            'Only CLIENT workspace OWNER can approve and release escrow',
        );
    }
};

const handleIdempotentRelease = async (
    existingEntries,
    userId,
    milestoneId,
    clientWorkspaceId,
    freelancerWorkspaceId,
    currency,
) => {
    if (existingEntries.length !== 2) {
        throw new AppError(
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            409,
            'Idempotency key reused or incomplete state',
        );
    }

    const debitEntry = existingEntries.find((e) => e.entrySide === 'ESCROW_DEBIT');
    const creditEntry = existingEntries.find((e) => e.entrySide === 'AVAILABLE_CREDIT');

    if (!debitEntry || !creditEntry) {
        throw new AppError(
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            409,
            'Idempotency key missing required entries',
        );
    }

    if (
        creditEntry.milestoneId.toString() !== milestoneId.toString() ||
        debitEntry.milestoneId.toString() !== milestoneId.toString()
    ) {
        throw new AppError(
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            409,
            'Idempotency key already used for a different milestone',
        );
    }

    const milestone = await milestoneService.getMilestone({ milestoneId, userId });
    const submission = await submissionService.getSubmission({ milestoneId, userId });

    const clientWallet = {
        _id: debitEntry.walletId,
        workspaceId: clientWorkspaceId,
        currency,
        availableAmountMinor: debitEntry.availableAmountAfterMinor,
        escrowedAmountMinor: debitEntry.escrowedAmountAfterMinor,
    };

    const freelancerWallet = {
        _id: creditEntry.walletId,
        workspaceId: freelancerWorkspaceId,
        currency,
        availableAmountMinor: creditEntry.availableAmountAfterMinor,
        escrowedAmountMinor: creditEntry.escrowedAmountAfterMinor,
    };

    return { milestone, submission, clientWallet, freelancerWallet, idempotent: true };
};

export const escrowReleaseService = {
    approveAndRelease: async ({ milestoneId, userId, idempotencyKey }) => {
        const milestone = await milestoneService.getMilestone({ milestoneId, userId });
        const agreement = await agreementService.getAgreement({
            agreementId: milestone.agreementId,
            userId,
        });

        await assertClientOwnerOfAgreement(agreement, userId);

        const currency = agreement.currency;
        const amountMinor = milestone.amountMinor;
        const clientWorkspaceId = agreement.clientWorkspaceId;
        const freelancerWorkspaceId = agreement.freelancerWorkspaceId;

        const existingEntries = await ledgerEntryRepository.findByOperationKey(
            clientWorkspaceId,
            'ESCROW_RELEASE',
            idempotencyKey,
        );

        if (existingEntries.length > 0) {
            return await handleIdempotentRelease(
                existingEntries,
                userId,
                milestoneId,
                clientWorkspaceId,
                freelancerWorkspaceId,
                currency,
            );
        }

        if (agreement.status !== 'ACTIVE') {
            throw new AppError(ErrorCodes.AGREEMENT_NOT_ACTIVE, 409, 'Agreement must be ACTIVE');
        }

        if (milestone.status !== 'SUBMITTED') {
            throw new AppError(ErrorCodes.CONFLICT, 409, 'Milestone must be SUBMITTED to approve');
        }

        await submissionService.getSubmission({ milestoneId, userId });

        const session = await mongoose.startSession();
        let approvedMilestone;
        let approvedSubmission;
        let clientWallet;
        let freelancerWallet;

        try {
            await session.withTransaction(async () => {
                clientWallet = await walletRepository.debitEscrow(
                    clientWorkspaceId,
                    currency,
                    amountMinor,
                    session,
                );

                if (!clientWallet) {
                    throw new AppError(
                        ErrorCodes.INSUFFICIENT_FUNDS,
                        409,
                        'Insufficient escrow balance',
                    );
                }

                freelancerWallet = await walletRepository.upsertCredit(
                    freelancerWorkspaceId,
                    currency,
                    amountMinor,
                    session,
                );

                const operationId = crypto.randomUUID();

                await ledgerEntryRepository.create(
                    {
                        walletId: clientWallet._id,
                        workspaceId: clientWorkspaceId,
                        idempotencyScopeWorkspaceId: clientWorkspaceId,
                        milestoneId,
                        currency,
                        operationId,
                        operationType: 'ESCROW_RELEASE',
                        entrySide: 'ESCROW_DEBIT',
                        amountMinor,
                        availableAmountAfterMinor: clientWallet.availableAmountMinor,
                        escrowedAmountAfterMinor: clientWallet.escrowedAmountMinor, // already decremented
                        idempotencyKey,
                        createdBy: userId,
                    },
                    session,
                );

                await ledgerEntryRepository.create(
                    {
                        walletId: freelancerWallet._id,
                        workspaceId: freelancerWorkspaceId,
                        idempotencyScopeWorkspaceId: clientWorkspaceId,
                        milestoneId,
                        currency,
                        operationId,
                        operationType: 'ESCROW_RELEASE',
                        entrySide: 'AVAILABLE_CREDIT',
                        amountMinor,
                        availableAmountAfterMinor: freelancerWallet.availableAmountMinor, // already incremented
                        escrowedAmountAfterMinor: freelancerWallet.escrowedAmountMinor,
                        idempotencyKey,
                        createdBy: userId,
                    },
                    session,
                );

                approvedMilestone = await milestoneService.markAsApproved({
                    milestoneId,
                    approvedBy: userId,
                    approvedAt: new Date(),
                    session,
                });

                approvedSubmission = await workSubmissionRepository.markAsApproved(
                    milestoneId,
                    {
                        approvedBy: userId,
                        approvedAt: new Date(),
                    },
                    session,
                );
            });
        } catch (error) {
            if (
                error.code === 11000 ||
                (error.message && error.message.includes('E11000')) ||
                error.statusCode === 409
            ) {
                const retryEntries = await ledgerEntryRepository.findByOperationKey(
                    clientWorkspaceId,
                    'ESCROW_RELEASE',
                    idempotencyKey,
                );

                if (retryEntries.length > 0) {
                    return await handleIdempotentRelease(
                        retryEntries,
                        userId,
                        milestoneId,
                        clientWorkspaceId,
                        freelancerWorkspaceId,
                        currency,
                    );
                }
            }
            throw error;
        } finally {
            await session.endSession();
        }

        return {
            milestone: approvedMilestone,
            submission: approvedSubmission,
            clientWallet,
            freelancerWallet,
            idempotent: false,
        };
    },
};
