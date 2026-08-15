import { Router } from 'express';
import { financeController } from './controllers/finance.controller.js';
import { financeValidator } from './validators/finance.validators.js';
import { authenticate } from '../../shared/middlewares/authenticate.middleware.js';
import { validateRequest } from '../../shared/middlewares/validate-request.middleware.js';
import { requireIdempotencyKey } from './middlewares/require-idempotency-key.middleware.js';

const router = Router();

router.use(authenticate);

router.get(
    '/wallets/:workspaceId',
    validateRequest(financeValidator.getWallet),
    financeController.getWallet,
);

router.post(
    '/wallets/:workspaceId/top-ups',
    requireIdempotencyKey,
    validateRequest(financeValidator.topUp),
    financeController.topUp,
);

router.post(
    '/milestones/:milestoneId/fund',
    requireIdempotencyKey,
    validateRequest(financeValidator.fundMilestone),
    financeController.fundMilestone,
);

router.post(
    '/milestones/:milestoneId/approve-and-release',
    requireIdempotencyKey,
    validateRequest(financeValidator.approveAndRelease),
    financeController.approveAndRelease,
);

export default router;
