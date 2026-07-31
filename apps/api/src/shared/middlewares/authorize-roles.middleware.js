import { ErrorCodes } from '../errors/error-codes.js';
import { AppError } from '../errors/app-error.js';

export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.auth || !req.auth.role) {
            return next(
                new AppError(ErrorCodes.AUTHENTICATION_REQUIRED, 401, 'Authentication required'),
            );
        }

        if (!allowedRoles.includes(req.auth.role)) {
            return next(new AppError(ErrorCodes.FORBIDDEN, 403, 'Forbidden'));
        }

        next();
    };
};
