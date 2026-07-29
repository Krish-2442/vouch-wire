import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';

import env from './shared/config/env.js';
import logger from './shared/config/logger.js';
import { requestIdMiddleware } from './shared/middlewares/request-id.middleware.js';
import { notFoundMiddleware } from './shared/middlewares/not-found.middleware.js';
import { errorHandlerMiddleware } from './shared/middlewares/error-handler.middleware.js';
import systemRoutes from './domains/system/routes.js';

const createApp = () => {
    const app = express();

    app.disable('x-powered-by');

    app.use(helmet());

    const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
    app.use(
        cors({
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    return callback(null, true);
                }
                return callback(new Error('Not allowed by CORS'));
            },
            credentials: true,
        }),
    );

    if (env.TRUST_PROXY > 0) {
        app.set('trust proxy', env.TRUST_PROXY);
    }

    app.use(express.json({ limit: env.API_BODY_LIMIT }));

    app.use(requestIdMiddleware);

    app.use(
        pinoHttp({
            logger,
            genReqId: (req) => req.id,
            serializers: {
                req: (req) => ({
                    id: req.id,
                    method: req.method,
                    url: req.url,
                }),
                res: (res) => ({
                    statusCode: res.statusCode,
                }),
            },
        }),
    );

    app.use('/api/v1/system', systemRoutes);

    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path.startsWith('/api/v1/system/health'),
    });
    app.use('/api', apiLimiter);

    app.use(notFoundMiddleware);
    app.use(errorHandlerMiddleware);

    return app;
};

export default createApp;
