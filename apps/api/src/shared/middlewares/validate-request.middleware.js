import { AppError } from '../errors/app-error.js';
import { ErrorCodes } from '../errors/error-codes.js';

export const validateRequest = (schema) => (req, _res, next) => {
    const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
    });

    if (!result.success) {
        const details = result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
        }));

        return next(new AppError(ErrorCodes.VALIDATION_ERROR, 400, 'Validation failed', details));
    }

    req.validated = result.data;
    return next();
};
