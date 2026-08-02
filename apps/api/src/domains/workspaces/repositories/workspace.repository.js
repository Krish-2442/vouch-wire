import { Workspace } from '../models/workspace.model.js';

export const workspaceRepository = {
    create: async (data, session) => {
        const [workspace] = await Workspace.create([data], { session });
        return workspace;
    },

    findById: async (id, session = null) => {
        const query = Workspace.findById(id);
        if (session) {
            query.session(session);
        }
        return query.exec();
    },

    findBySlug: async (slug, session = null) => {
        const query = Workspace.findOne({ slug });
        if (session) {
            query.session(session);
        }
        return query.exec();
    },

    updateById: async (id, data, session = null) => {
        const query = Workspace.findByIdAndUpdate(id, data, { new: true });
        if (session) {
            query.session(session);
        }
        return query.exec();
    },
};
