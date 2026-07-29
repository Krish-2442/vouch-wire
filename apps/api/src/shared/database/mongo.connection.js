import mongoose from 'mongoose';
import logger from '../config/logger.js';
import env from '../config/env.js';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export const connectToDatabase = async () => {
    mongoose.set('bufferCommands', false);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await mongoose.connect(env.MONGODB_URI);

            const admin = mongoose.connection.db.admin();
            const hello = await admin.command({ hello: 1 });

            if (hello.setName !== env.MONGODB_REPLICA_SET) {
                throw new Error(
                    `Expected replica set "${env.MONGODB_REPLICA_SET}", got "${hello.setName}"`,
                );
            }

            if (!hello.isWritablePrimary) {
                throw new Error('Connected MongoDB member is not a writable primary');
            }

            if (!hello.logicalSessionTimeoutMinutes) {
                throw new Error('Logical sessions are not available');
            }

            logger.info({
                msg: 'MongoDB connected and topology verified',
                replicaSet: hello.setName,
                isWritablePrimary: hello.isWritablePrimary,
                logicalSessionTimeoutMinutes: hello.logicalSessionTimeoutMinutes,
            });

            return;
        } catch (error) {
            logger.warn({
                msg: `MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed`,
                error: error.message,
            });

            if (attempt === MAX_RETRIES) {
                throw error;
            }

            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
};

export const disconnectFromDatabase = async () => {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected');
};

export const isDatabaseReady = () => {
    return mongoose.connection.readyState === 1;
};

export const verifyDatabaseTopology = async () => {
    const admin = mongoose.connection.db.admin();
    const hello = await admin.command({ hello: 1 });

    return {
        setName: hello.setName,
        isWritablePrimary: hello.isWritablePrimary,
        logicalSessionTimeoutMinutes: hello.logicalSessionTimeoutMinutes,
    };
};
