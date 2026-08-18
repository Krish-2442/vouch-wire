import { submissionService } from '../services/submission.service.js';
import { successResponse } from '../../../shared/utils/api-response.js';

export const submissionController = {
    submitWork: async (req, res) => {
        const submission = await submissionService.submitWork({
            milestoneId: req.validated.params.milestoneId,
            userId: req.auth.userId,
            summary: req.validated.body.summary,
            evidenceUrl: req.validated.body.evidenceUrl,
        });

        return successResponse(res, { data: submission, statusCode: 201 });
    },

    getSubmission: async (req, res) => {
        const submission = await submissionService.getSubmission({
            milestoneId: req.validated.params.milestoneId,
            userId: req.auth.userId,
        });

        return successResponse(res, { data: submission });
    },
};
