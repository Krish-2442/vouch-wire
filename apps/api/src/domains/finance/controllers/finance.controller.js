import { walletService } from '../services/wallet.service.js';
import { escrowFundingService } from '../services/escrow-funding.service.js';
import { successResponse } from '../../../shared/utils/api-response.js';

export const financeController = {
    getWallet: async (req, res) => {
        const wallet = await walletService.getWallet({
            workspaceId: req.validated.params.workspaceId,
            currency: req.validated.query.currency,
            userId: req.auth.userId,
        });

        return successResponse(res, { data: wallet });
    },

    topUp: async (req, res) => {
        const result = await walletService.topUp({
            workspaceId: req.validated.params.workspaceId,
            currency: req.validated.body.currency,
            amountMinor: req.validated.body.amountMinor,
            userId: req.auth.userId,
            idempotencyKey: req.idempotencyKey,
        });

        return successResponse(res, {
            data: { wallet: result.wallet },
            statusCode: result.idempotent ? 200 : 201,
        });
    },

    fundMilestone: async (req, res) => {
        const result = await escrowFundingService.fundMilestone({
            milestoneId: req.validated.params.milestoneId,
            userId: req.auth.userId,
            idempotencyKey: req.idempotencyKey,
        });

        return successResponse(res, {
            data: {
                milestone: result.milestone,
                wallet: result.wallet,
            },
            statusCode: result.idempotent ? 200 : 201,
        });
    },
};
