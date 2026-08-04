import { milestoneService } from '../services/milestone.service.js';
import { successResponse } from '../../../shared/utils/api-response.js';

export const milestoneController = {
    createMilestone: async (req, res, next) => {
        try {
            const milestone = await milestoneService.createMilestone({
                agreementId: req.validated.params.agreementId,
                body: req.validated.body,
                userId: req.auth.userId,
            });

            return successResponse(res, {
                data: milestone,
                statusCode: 201,
            });
        } catch (error) {
            next(error);
        }
    },

    getMilestone: async (req, res, next) => {
        try {
            const milestone = await milestoneService.getMilestone({
                milestoneId: req.validated.params.milestoneId,
                userId: req.auth.userId,
            });

            return successResponse(res, {
                data: milestone,
            });
        } catch (error) {
            next(error);
        }
    },

    listMilestones: async (req, res, next) => {
        try {
            const milestones = await milestoneService.listMilestones({
                agreementId: req.validated.params.agreementId,
                userId: req.auth.userId,
                page: req.validated.query.page,
                limit: req.validated.query.limit,
            });

            return successResponse(res, {
                data: milestones,
            });
        } catch (error) {
            next(error);
        }
    },

    updateMilestone: async (req, res, next) => {
        try {
            const milestone = await milestoneService.updateMilestone({
                milestoneId: req.validated.params.milestoneId,
                userId: req.auth.userId,
                updates: req.validated.body,
            });

            return successResponse(res, {
                data: milestone,
            });
        } catch (error) {
            next(error);
        }
    },

    deleteMilestone: async (req, res, next) => {
        try {
            await milestoneService.deleteMilestone({
                milestoneId: req.validated.params.milestoneId,
                userId: req.auth.userId,
            });

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    },
};
