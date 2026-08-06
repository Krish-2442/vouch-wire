import { milestoneService } from '../services/milestone.service.js';
import { successResponse } from '../../../shared/utils/api-response.js';

export const milestoneController = {
    createMilestone: async (req, res) => {
        const milestone = await milestoneService.createMilestone({
            agreementId: req.validated.params.agreementId,
            body: req.validated.body,
            userId: req.auth.userId,
        });

        return successResponse(res, {
            data: milestone,
            statusCode: 201,
        });
    },

    getMilestone: async (req, res) => {
        const milestone = await milestoneService.getMilestone({
            milestoneId: req.validated.params.milestoneId,
            userId: req.auth.userId,
        });

        return successResponse(res, {
            data: milestone,
        });
    },

    listMilestones: async (req, res) => {
        const result = await milestoneService.listMilestones({
            agreementId: req.validated.params.agreementId,
            userId: req.auth.userId,
            page: req.validated.query.page,
            limit: req.validated.query.limit,
        });

        return successResponse(res, {
            data: result.milestones,
            pagination: {
                total: result.total,
                page: result.page,
                limit: result.limit,
            },
        });
    },

    updateMilestone: async (req, res) => {
        const milestone = await milestoneService.updateMilestone({
            milestoneId: req.validated.params.milestoneId,
            userId: req.auth.userId,
            updates: req.validated.body,
        });

        return successResponse(res, {
            data: milestone,
        });
    },

    deleteMilestone: async (req, res) => {
        await milestoneService.deleteMilestone({
            milestoneId: req.validated.params.milestoneId,
            userId: req.auth.userId,
        });

        res.status(204).send();
    },
};
