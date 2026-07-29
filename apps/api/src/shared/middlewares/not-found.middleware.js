import { AppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/error-codes.js';

export const notFoundMiddleware = (req, _res, next) => {
    next(
        new AppError(ErrorCodes.NOT_FOUND, 404, `Route ${req.method} ${req.originalUrl} not found`),
    );
};
