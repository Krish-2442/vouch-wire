import { Milestone } from '../models/milestone.model.js';

export const milestoneRepository = {
    create: async (data) => {
        return Milestone.create(data);
    },

    findById: async (id) => {
        return Milestone.findById(id).exec();
    },

    findByAgreementId: async (agreementId, { skip = 0, limit = 10 } = {}) => {
        return Milestone.find({ agreementId })
            .sort({ sequence: 1 })
            .skip(skip)
            .limit(limit)
            .populate('createdBy', '_id fullName email')
            .lean()
            .exec();
    },

    countByAgreementId: async (agreementId) => {
        return Milestone.countDocuments({ agreementId }).exec();
    },

    updateDraft: async (id, data) => {
        return Milestone.findOneAndUpdate({ _id: id, status: 'DRAFT' }, data, {
            new: true,
            runValidators: true,
        }).exec();
    },

    deleteDraft: async (id) => {
        return Milestone.findOneAndDelete({ _id: id, status: 'DRAFT' }).exec();
    },

    fundMilestone: async (milestoneId, { fundedBy, fundedAt }, session) => {
        return Milestone.findOneAndUpdate(
            { _id: milestoneId, status: 'DRAFT' },
            { status: 'FUNDED', fundedBy, fundedAt },
            { new: true, runValidators: true, session },
        ).exec();
    },

    getCommittedAmount: async (agreementId, session) => {
        const result = await Milestone.aggregate([
            { $match: { agreementId, status: { $in: ['FUNDED', 'SUBMITTED', 'APPROVED'] } } },
            { $group: { _id: null, total: { $sum: '$amountMinor' } } },
        ]).session(session);
        return result.length > 0 ? result[0].total : 0;
    },
};
