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

    updateById: async (id, data) => {
        return Agreement.findByIdAndUpdate(id, data, { new: true }).exec();
    },

    updateAgreementStatus: async (agreementId, currentStatus, newStatus, metadata = {}) => {
        return Agreement.findOneAndUpdate(
            { _id: agreementId, status: currentStatus },
            { status: newStatus, ...metadata },
            { new: true },
        ).exec();
    },
};
