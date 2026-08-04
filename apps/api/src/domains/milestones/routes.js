import { Router } from 'express';
import { milestoneController } from './controllers/milestone.controller.js';
import { milestoneValidator } from './validators/milestone.validators.js';
import { authenticate } from '../../shared/middlewares/authenticate.middleware.js';
import { validateRequest } from '../../shared/middlewares/validate-request.middleware.js';

const router = Router();

router.use(authenticate);

router.post(
    '/agreements/:agreementId',
    validateRequest(milestoneValidator.createMilestone),
    milestoneController.createMilestone,
);

router.get(
    '/agreements/:agreementId',
    validateRequest(milestoneValidator.listMilestones),
    milestoneController.listMilestones,
);

router.get(
    '/:milestoneId',
    validateRequest(milestoneValidator.getMilestone),
    milestoneController.getMilestone,
);

router.patch(
    '/:milestoneId',
    validateRequest(milestoneValidator.updateMilestone),
    milestoneController.updateMilestone,
);

router.delete(
    '/:milestoneId',
    validateRequest(milestoneValidator.deleteMilestone),
    milestoneController.deleteMilestone,
);

export default router;
