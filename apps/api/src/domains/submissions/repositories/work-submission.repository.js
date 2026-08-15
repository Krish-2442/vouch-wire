import { WorkSubmission } from '../models/work-submission.model.js';

export const workSubmissionRepository = {
    create: async (data, session) => {
        const [submission] = await WorkSubmission.create([data], { session });
        return submission;
    },

    findByMilestoneId: async (milestoneId) => {
        return WorkSubmission.findOne({ milestoneId }).lean().exec();
    },

    markAsApproved: async (milestoneId, { approvedBy, approvedAt }, session) => {
        return WorkSubmission.findOneAndUpdate(
            { milestoneId, approvedAt: { $exists: false } },
            { approvedBy, approvedAt },
            { new: true, runValidators: true, session },
        ).exec();
    },
};
