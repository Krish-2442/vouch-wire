import { Router } from 'express';
import { submissionController } from './controllers/submission.controller.js';
import { submissionValidator } from './validators/submission.validators.js';
import { authenticate } from '../../shared/middlewares/authenticate.middleware.js';
import { validateRequest } from '../../shared/middlewares/validate-request.middleware.js';

const router = Router();

router.use(authenticate);

router.post(
    '/milestones/:milestoneId',
    validateRequest(submissionValidator.submitWork),
    submissionController.submitWork,
);

router.get(
    '/milestones/:milestoneId',
    validateRequest(submissionValidator.getSubmission),
    submissionController.getSubmission,
);

export default router;
