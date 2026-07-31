import mongoose from 'mongoose';
import { beforeAll, afterEach, afterAll } from 'vitest';
import env from '../../src/shared/config/env.js';

export const setupTestDatabase = () => {
    beforeAll(async () => {
        if (env.NODE_ENV !== 'test') {
            throw new Error('Test database lifecycle helper can only be used in test environment');
        }

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(env.MONGODB_URI, {
                serverSelectionTimeoutMS: 5000,
            });
        }

        // Ensure indexes are built to test unique constraints
        const models = mongoose.modelNames();
        await Promise.all(models.map((model) => mongoose.model(model).init()));
    });

    afterEach(async () => {
        const collections = mongoose.connection.collections;
        for (const key in collections) {
            const collection = collections[key];
            await collection.deleteMany({});
        }
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });
};
