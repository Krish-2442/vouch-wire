import { AppError } from '../../../shared/errors/app-error.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';

const MAX_KEY_LENGTH = 256;

export const requireIdempotencyKey = (req, _res, next) => {
    const key = req.headers['idempotency-key'];

    if (!key || typeof key !== 'string' || key.trim().length === 0) {
        return next(
            new AppError(
                ErrorCodes.IDEMPOTENCY_KEY_REQUIRED,
                400,
                'Idempotency-Key header is required',
            ),
        );
    }

    if (key.length > MAX_KEY_LENGTH) {
        return next(
            new AppError(
                ErrorCodes.IDEMPOTENCY_KEY_REQUIRED,
                400,
                'Idempotency-Key header is too long',
            ),
        );
    }

    req.idempotencyKey = key.trim();
    return next();
};
