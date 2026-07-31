import rateLimit from 'express-rate-limit';
import env from '../../../shared/config/env.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';
import { AppError } from '../../../shared/errors/app-error.js';

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs for auth routes
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    handler: (req, res, next, options) => {
        next(
            new AppError(
                ErrorCodes.RATE_LIMIT_EXCEEDED,
                options.statusCode,
                'Too many authentication attempts, please try again later.',
            ),
        );
    },
});
