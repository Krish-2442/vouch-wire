import pino from 'pino';
import env from './env.js';

const logger = pino({
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === 'development' && {
        transport: {
            target: 'pino/file',
            options: { destination: 1 },
        },
    }),
});

export default logger;
