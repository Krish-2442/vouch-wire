import { ErrorCodes } from '../errors/error-codes.js';

export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.auth || !req.auth.role) {
            const err = new Error('Authentication required');
            err.code = ErrorCodes.AUTHENTICATION_REQUIRED;
            err.statusCode = 401;
            return next(err);
        }

        if (!allowedRoles.includes(req.auth.role)) {
            const err = new Error('Forbidden');
            err.code = ErrorCodes.FORBIDDEN;
            err.statusCode = 403;
            return next(err);
        }

        next();
    };
};
