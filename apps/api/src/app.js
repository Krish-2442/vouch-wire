import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';

import env from './shared/config/env.js';
import logger from './shared/config/logger.js';
import { requestIdMiddleware } from './shared/middlewares/request-id.middleware.js';
import { notFoundMiddleware } from './shared/middlewares/not-found.middleware.js';
import { errorHandlerMiddleware } from './shared/middlewares/error-handler.middleware.js';
import systemRoutes from './domains/system/routes.js';
import identityRoutes from './domains/identity/routes.js';
import workspaceRoutes from './domains/workspaces/routes.js';
import agreementRoutes from './domains/agreements/routes.js';
import { ErrorCodes } from './shared/errors/error-codes.js';
import { AppError } from './shared/errors/app-error.js';

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
                return callback(new AppError(ErrorCodes.FORBIDDEN, 403, 'Not allowed by CORS'));
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

    app.use(cookieParser());

    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => env.NODE_ENV === 'test' || req.originalUrl.startsWith('/api/v1/system/health'),
        handler: (req, res, next, options) => {
            next(new AppError(ErrorCodes.RATE_LIMIT_EXCEEDED, options.statusCode, options.message));
        },
    });
    app.use('/api', apiLimiter);

    app.use('/api/v1/system', systemRoutes);
    app.use('/api/v1/auth', identityRoutes);
    app.use('/api/v1/workspaces', workspaceRoutes);
    app.use('/api/v1/agreements', agreementRoutes);

    app.use(notFoundMiddleware);
    app.use(errorHandlerMiddleware);

    return app;
};

export default createApp;
