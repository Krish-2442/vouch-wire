import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { walletRepository } from '../repositories/wallet.repository.js';
import { ledgerEntryRepository } from '../repositories/ledger-entry.repository.js';
import { agreementService } from '../../agreements/services/agreement.service.js';
import { milestoneService } from '../../milestones/services/milestone.service.js';
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
            'Only CLIENT workspace OWNER can fund milestones',
        );
    }
};

const handleIdempotentFunding = (existingEntries, { milestoneId, workspaceId, currency }) => {
    if (existingEntries.length !== 2) {
        throw new AppError(
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            409,
            'Idempotency key reused or incomplete state',
        );
    }

    const debitEntry = existingEntries.find((e) => e.entrySide === 'AVAILABLE_DEBIT');
    const creditEntry = existingEntries.find((e) => e.entrySide === 'ESCROW_CREDIT');

    if (!debitEntry || !creditEntry) {
        throw new AppError(
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            409,
            'Idempotency key missing required entries',
        );
    }

    if (
        creditEntry.milestoneId.toString() !== milestoneId ||
        debitEntry.milestoneId.toString() !== milestoneId
    ) {
        throw new AppError(
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            409,
            'Idempotency key already used for a different milestone',
        );
    }

    if (
        debitEntry.currency !== currency ||
        debitEntry.operationId !== creditEntry.operationId ||
        debitEntry.amountMinor !== creditEntry.amountMinor ||
        debitEntry.walletId.toString() !== creditEntry.walletId.toString()
    ) {
        throw new AppError(
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            409,
            'Idempotency key already used with different parameters',
        );
    }

    const wallet = {
        _id: debitEntry.walletId,
        workspaceId,
        currency,
        availableAmountMinor: debitEntry.availableAmountAfterMinor,
        escrowedAmountMinor: creditEntry.escrowedAmountAfterMinor,
    };

    return { wallet, ledgerEntries: existingEntries, idempotent: true };
};

export const escrowFundingService = {
    fundMilestone: async ({ milestoneId, userId, idempotencyKey }) => {
        const milestone = await milestoneService.getMilestone({ milestoneId, userId });

        const agreement = await agreementService.getAgreement({
            agreementId: milestone.agreementId,
            userId,
        });

        if (agreement.status !== 'ACTIVE') {
            throw new AppError(
                ErrorCodes.AGREEMENT_NOT_ACTIVE,
                409,
                'Agreement must be ACTIVE to fund milestones',
            );
        }

        await assertClientOwnerOfAgreement(agreement, userId);

        const currency = agreement.currency;
        const amountMinor = milestone.amountMinor;
        const workspaceId = agreement.clientWorkspaceId;

        const existingEntries = await ledgerEntryRepository.findByOperationKey(
            workspaceId,
            'MILESTONE_FUND',
            idempotencyKey,
        );

        if (existingEntries.length > 0) {
            const result = handleIdempotentFunding(existingEntries, {
                milestoneId,
                workspaceId,
                currency,
            });
            return { milestone, ...result };
        }

        if (milestone.status !== 'DRAFT') {
            throw new AppError(ErrorCodes.CONFLICT, 409, 'Milestone is no longer in DRAFT status');
        }

        const session = await mongoose.startSession();
        let fundedMilestone;
        let wallet;
        let ledgerEntries = [];

        try {
            await session.withTransaction(async () => {
                wallet = await walletRepository.debitAvailableCreditEscrow(
                    workspaceId,
                    currency,
                    amountMinor,
                    session,
                );

                if (!wallet) {
                    throw new AppError(
                        ErrorCodes.INSUFFICIENT_FUNDS,
                        409,
                        'Insufficient available balance to fund this milestone',
                    );
                }

                const operationId = crypto.randomUUID();

                const debitEntry = await ledgerEntryRepository.create(
                    {
                        walletId: wallet._id,
                        workspaceId,
                        idempotencyScopeWorkspaceId: workspaceId,
                        milestoneId,
                        currency,
                        operationId,
                        operationType: 'MILESTONE_FUND',
                        entrySide: 'AVAILABLE_DEBIT',
                        amountMinor,
                        availableAmountAfterMinor: wallet.availableAmountMinor,
                        escrowedAmountAfterMinor: wallet.escrowedAmountMinor - amountMinor,
                        idempotencyKey,
                        createdBy: userId,
                    },
                    session,
                );

                const escrowEntry = await ledgerEntryRepository.create(
                    {
                        walletId: wallet._id,
                        workspaceId,
                        idempotencyScopeWorkspaceId: workspaceId,
                        milestoneId,
                        currency,
                        operationId,
                        operationType: 'MILESTONE_FUND',
                        entrySide: 'ESCROW_CREDIT',
                        amountMinor,
                        availableAmountAfterMinor: wallet.availableAmountMinor,
                        escrowedAmountAfterMinor: wallet.escrowedAmountMinor,
                        idempotencyKey,
                        createdBy: userId,
                    },
                    session,
                );

                ledgerEntries = [debitEntry, escrowEntry];

                fundedMilestone = await milestoneService.markAsFunded({
                    milestoneId,
                    fundedBy: userId,
                    fundedAt: new Date(),
                    session,
                });
            });
        } catch (error) {
            if (error.code === 11000 || (error.message && error.message.includes('E11000'))) {
                const retryEntries = await ledgerEntryRepository.findByOperationKey(
                    workspaceId,
                    'MILESTONE_FUND',
                    idempotencyKey,
                );

                if (retryEntries.length > 0) {
                    const result = handleIdempotentFunding(retryEntries, {
                        milestoneId,
                        workspaceId,
                        currency,
                    });
                    const finalMilestone = await milestoneService.getMilestone({
                        milestoneId,
                        userId,
                    });

                    return { milestone: finalMilestone, ...result };
                }
            }
            throw error;
        } finally {
            await session.endSession();
        }

        return {
            milestone: fundedMilestone,
            wallet,
            ledgerEntries,
            idempotent: false,
        };
    },
};
