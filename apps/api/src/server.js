import env from './shared/config/env.js';
import logger from './shared/config/logger.js';
import createApp from './app.js';
import { connectToDatabase, disconnectFromDatabase } from './shared/database/mongo.connection.js';

let server = null;
let isShuttingDown = false;

const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ msg: 'Shutdown initiated', signal });

    if (server) {
        await new Promise((resolve) => {
            server.close(resolve);
        });
        logger.info('HTTP server closed');
    }

    await disconnectFromDatabase();
    logger.info('Shutdown complete');
    process.exit(0);
};

const startServer = async () => {
    try {
        await connectToDatabase();

        const app = createApp();

        server = app.listen(env.PORT, () => {
            logger.info({
                msg: `VouchWire API running on http://localhost:${env.PORT}`,
                environment: env.NODE_ENV,
            });
        });
    } catch (error) {
        logger.fatal({ msg: 'Failed to start server', error: error.message });
        process.exit(1);
    }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    logger.fatal({ msg: 'Unhandled rejection', reason });
    shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
    logger.fatal({ msg: 'Uncaught exception', error: error.message });
    shutdown('uncaughtException');
});

startServer();
