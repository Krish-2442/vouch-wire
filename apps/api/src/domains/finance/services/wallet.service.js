import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { walletRepository } from '../repositories/wallet.repository.js';
import { ledgerEntryRepository } from '../repositories/ledger-entry.repository.js';
import { workspaceMembershipService } from '../../workspaces/services/workspace-membership.service.js';
import { workspaceService } from '../../workspaces/services/workspace.service.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

const assertClientOwner = async (workspaceId, userId) => {
    const workspace = await workspaceService.getWorkspaceById({ workspaceId });
    if (workspace.workspaceType !== 'CLIENT') {
        throw new AppError(
            ErrorCodes.FORBIDDEN,
            403,
            'Only CLIENT workspace wallets can be topped up',
        );
    }

    const access = await workspaceMembershipService.checkAccess({ workspaceId, userId });
    if (!access) {
        throw new AppError(ErrorCodes.WORKSPACE_NOT_FOUND, 404, 'Workspace not found');
    }
    if (access.membershipRole !== 'OWNER') {
        throw new AppError(
            ErrorCodes.FORBIDDEN,
            403,
            'Only the workspace OWNER can perform this action',
        );
    }

    return workspace;
};

const handleIdempotentTopUp = (existingEntries, { currency, amountMinor, workspaceId }) => {
    const entry = existingEntries[0];

    if (entry.currency !== currency || entry.amountMinor !== amountMinor) {
        throw new AppError(
            ErrorCodes.IDEMPOTENCY_KEY_REUSED,
            409,
            'Idempotency key already used with different parameters',
        );
    }

    const wallet = {
        _id: entry.walletId,
        workspaceId,
        currency,
        availableAmountMinor: entry.availableAmountAfterMinor,
        escrowedAmountMinor: entry.escrowedAmountAfterMinor,
    };

    return { wallet, ledgerEntry: entry, idempotent: true };
};

export const walletService = {
    getWallet: async ({ workspaceId, currency, userId }) => {
        const access = await workspaceMembershipService.checkAccess({ workspaceId, userId });
        if (!access) {
            throw new AppError(ErrorCodes.WORKSPACE_NOT_FOUND, 404, 'Workspace not found');
        }
        if (access.membershipRole !== 'OWNER') {
            throw new AppError(
                ErrorCodes.FORBIDDEN,
                403,
                'Only the workspace OWNER can view the wallet',
            );
        }

        const wallet = await walletRepository.findByWorkspaceAndCurrency(workspaceId, currency);
        if (!wallet) {
            return {
                workspaceId,
                currency,
                availableAmountMinor: 0,
                escrowedAmountMinor: 0,
            };
        }

        return wallet;
    },

    topUp: async ({ workspaceId, currency, amountMinor, userId, idempotencyKey }) => {
        await assertClientOwner(workspaceId, userId);

        const existingEntries = await ledgerEntryRepository.findByOperationKey(
            workspaceId,
            'WALLET_TOP_UP',
            idempotencyKey,
        );

        if (existingEntries.length > 0) {
            return handleIdempotentTopUp(existingEntries, {
                currency,
                amountMinor,
                workspaceId,
            });
        }

        const session = await mongoose.startSession();
        let wallet;
        let ledgerEntry;

        try {
            await session.withTransaction(async () => {
                wallet = await walletRepository.upsertCredit(
                    workspaceId,
                    currency,
                    amountMinor,
                    session,
                );

                const operationId = crypto.randomUUID();
                ledgerEntry = await ledgerEntryRepository.create(
                    {
                        walletId: wallet._id,
                        workspaceId,
                        idempotencyScopeWorkspaceId: workspaceId,
                        currency,
                        operationId,
                        operationType: 'WALLET_TOP_UP',
                        entrySide: 'AVAILABLE_CREDIT',
                        amountMinor,
                        availableAmountAfterMinor: wallet.availableAmountMinor,
                        escrowedAmountAfterMinor: wallet.escrowedAmountMinor,
                        idempotencyKey,
                        createdBy: userId,
                    },
                    session,
                );
            });
        } catch (error) {
            if (error.name === 'MongoServerError' && error.code === 11000) {
                const retryEntries = await ledgerEntryRepository.findByOperationKey(
                    workspaceId,
                    'WALLET_TOP_UP',
                    idempotencyKey,
                );

                if (retryEntries.length > 0) {
                    return handleIdempotentTopUp(retryEntries, {
                        currency,
                        amountMinor,
                        workspaceId,
                    });
                }
            }
            throw error;
        } finally {
            await session.endSession();
        }

        return { wallet, ledgerEntry, idempotent: false };
    },
};
