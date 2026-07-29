import {
    isDatabaseReady,
    verifyDatabaseTopology,
} from '../../../shared/database/mongo.connection.js';

export const checkLiveness = () => {
    return {
        status: 'alive',
        timestamp: new Date().toISOString(),
    };
};

export const checkReadiness = async () => {
    if (!isDatabaseReady()) {
        return {
            ready: false,
            reason: 'MongoDB connection is not active',
        };
    }

    const topology = await verifyDatabaseTopology();

    if (topology.setName !== 'rs0' || !topology.isWritablePrimary) {
        return {
            ready: false,
            reason: 'MongoDB is not a writable primary in replica set rs0',
        };
    }

    return {
        ready: true,
        database: {
            replicaSet: topology.setName,
            isWritablePrimary: topology.isWritablePrimary,
        },
    };
};
