import { ErrorCodes } from '../errors/error-codes.js';
import { errorResponse } from '../utils/api-response.js';
import logger from '../config/logger.js';
import env from '../config/env.js';

export const errorHandlerMiddleware = (err, req, res, _next) => {
    const isOperational = err.isOperational || false;
    const statusCode = err.statusCode || 500;
    const code = err.code || ErrorCodes.INTERNAL_ERROR;
    const details = err.details || [];

    const message =
        isOperational || env.NODE_ENV === 'development'
            ? err.message
            : 'An unexpected error occurred';

    logger.error({
        err,
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        statusCode,
        code,
    });

    return errorResponse(res, {
        code,
        message,
        details,
        statusCode,
        requestId: req.id,
    });
};
