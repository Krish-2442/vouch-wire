import { User } from '../models/user.model.js';

export const userRepository = {
    create: async (userData, options = {}) => {
        const [user] = await User.create([userData], options);
        return user;
    },

    findByEmail: async (email, options = {}) => {
        return User.findOne({ email }, null, options).select('+passwordHash');
    },

    findById: async (id, options = {}) => {
        return User.findById(id, null, options);
    },
};
