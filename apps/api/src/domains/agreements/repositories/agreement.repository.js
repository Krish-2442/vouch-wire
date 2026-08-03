import { Agreement } from '../models/agreement.model.js';

export const agreementRepository = {
    create: async (data) => {
        return Agreement.create(data);
    },

    findById: async (id) => {
        return Agreement.findById(id).exec();
    },

    findByWorkspaceId: async (workspaceId, { skip = 0, limit = 10 } = {}) => {
        return Agreement.find({
            $or: [{ clientWorkspaceId: workspaceId }, { freelancerWorkspaceId: workspaceId }],
        })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();
    },

    updateDraft: async (id, data) => {
        return Agreement.findOneAndUpdate({ _id: id, status: 'DRAFT' }, data, {
            new: true,
            runValidators: true,
        }).exec();
    },

    updateAgreementStatus: async (agreementId, currentStatus, newStatus, metadata = {}) => {
        return Agreement.findOneAndUpdate(
            { _id: agreementId, status: currentStatus },
            { status: newStatus, ...metadata },
            { new: true, runValidators: true },
        ).exec();
    },
};
