import { User } from '../models/user.model.js';

export const userRepository = {
    create: async (userData) => {
        const user = new User(userData);
        return user.save();
    },

    findByEmail: async (email, options = {}) => {
        return User.findOne({ email }, null, options).select('+passwordHash');
    },

    findById: async (id, options = {}) => {
        return User.findById(id, null, options);
    },
};
