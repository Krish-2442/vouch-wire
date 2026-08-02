import { Router } from 'express';
import { agreementController } from './controllers/agreement.controller.js';
import { agreementValidator } from './validators/agreement.validators.js';
import { validateRequest } from '../../shared/middlewares/validate-request.middleware.js';
import { authenticate } from '../../shared/middlewares/authenticate.middleware.js';
import { authorizeRoles } from '../../shared/middlewares/authorize-roles.middleware.js';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('CLIENT', 'FREELANCER'));

router.post(
    '/',
    validateRequest(agreementValidator.createAgreement),
    agreementController.createAgreement,
);

router.get(
    '/workspaces/:workspaceId',
    validateRequest(agreementValidator.listAgreements),
    agreementController.listAgreements,
);

router.get(
    '/:agreementId',
    validateRequest(agreementValidator.getAgreement),
    agreementController.getAgreement,
);

router.patch(
    '/:agreementId',
    validateRequest(agreementValidator.updateAgreement),
    agreementController.updateAgreement,
);

router.post(
    '/:agreementId/propose',
    validateRequest(agreementValidator.agreementAction),
    agreementController.proposeAgreement,
);

router.post(
    '/:agreementId/accept',
    validateRequest(agreementValidator.agreementAction),
    agreementController.acceptAgreement,
);

router.post(
    '/:agreementId/reject',
    validateRequest(agreementValidator.agreementAction),
    agreementController.rejectAgreement,
);

router.post(
    '/:agreementId/cancel',
    validateRequest(agreementValidator.agreementAction),
    agreementController.cancelAgreement,
);

export default router;
