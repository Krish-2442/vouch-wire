import mongoose from 'mongoose';
import { beforeAll, afterEach, afterAll } from 'vitest';
import env from '../src/shared/config/env.js';

beforeAll(async () => {
    // Connect to the test database
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(env.MONGODB_URI);
    }
    
    // Ensure indexes are built to test unique constraints
    const models = mongoose.modelNames();
    await Promise.all(models.map(model => mongoose.model(model).init()));
});

afterEach(async () => {
    // Safely clean up collections between tests
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});

afterAll(async () => {
    // Disconnect and close the connection
    await mongoose.connection.close();
});
