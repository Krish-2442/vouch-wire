import { agreementService } from '../services/agreement.service.js';
import { successResponse } from '../../../shared/utils/api-response.js';

export const agreementController = {
    createAgreement: async (req, res) => {
        const agreement = await agreementService.createAgreement({
            body: req.validated.body,
            userId: req.auth.userId,
        });

        return successResponse(res, { data: agreement, statusCode: 201 });
    },

    getAgreement: async (req, res) => {
        const agreement = await agreementService.getAgreement({
            agreementId: req.validated.params.agreementId,
            userId: req.auth.userId,
        });

        return successResponse(res, { data: agreement, statusCode: 200 });
    },

    listAgreements: async (req, res) => {
        const { workspaceId } = req.validated.params;
        const { page, limit } = req.validated.query;

        const agreements = await agreementService.listAgreements({
            workspaceId,
            userId: req.auth.userId,
            page,
            limit,
        });

        return successResponse(res, { data: agreements, statusCode: 200 });
    },

    updateAgreement: async (req, res) => {
        const agreement = await agreementService.updateAgreement({
            agreementId: req.validated.params.agreementId,
            userId: req.auth.userId,
            updates: req.validated.body,
        });

        return successResponse(res, { data: agreement, statusCode: 200 });
    },

    proposeAgreement: async (req, res) => {
        const agreement = await agreementService.proposeAgreement({
            agreementId: req.validated.params.agreementId,
            userId: req.auth.userId,
        });

        return successResponse(res, { data: agreement, statusCode: 200 });
    },

    acceptAgreement: async (req, res) => {
        const agreement = await agreementService.acceptAgreement({
            agreementId: req.validated.params.agreementId,
            userId: req.auth.userId,
        });

        return successResponse(res, { data: agreement, statusCode: 200 });
    },

    rejectAgreement: async (req, res) => {
        const agreement = await agreementService.rejectAgreement({
            agreementId: req.validated.params.agreementId,
            userId: req.auth.userId,
        });

        return successResponse(res, { data: agreement, statusCode: 200 });
    },

    cancelAgreement: async (req, res) => {
        const agreement = await agreementService.cancelAgreement({
            agreementId: req.validated.params.agreementId,
            userId: req.auth.userId,
        });

        return successResponse(res, { data: agreement, statusCode: 200 });
    },
};
