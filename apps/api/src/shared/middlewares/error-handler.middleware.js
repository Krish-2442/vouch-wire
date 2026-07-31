import { ErrorCodes } from '../errors/error-codes.js';
import { errorResponse } from '../utils/api-response.js';
import logger from '../config/logger.js';
import env from '../config/env.js';

export const errorHandlerMiddleware = (err, req, res, _next) => {
    const isOperational = err.isOperational || false;
    let code = err.code || ErrorCodes.INTERNAL_ERROR;
    let message =
        isOperational || env.NODE_ENV === 'development'
            ? err.message
            : 'An unexpected error occurred';
    let statusCode = err.statusCode || 500;

    if (err.name === 'MongoServerError' && err.code === 11000) {
        statusCode = 409;
        if (err.message && err.message.includes('email')) {
            code = ErrorCodes.EMAIL_ALREADY_EXISTS;
            message = 'Email already exists';
        } else {
            code = ErrorCodes.CONFLICT;
            message = 'A resource with this unique value already exists';
        }
    }

    const details = err.details || [];

    logger.error({
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
