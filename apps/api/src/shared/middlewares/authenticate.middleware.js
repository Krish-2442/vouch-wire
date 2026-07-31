import { tokenService } from '../../domains/identity/services/token.service.js';
import { userRepository } from '../../domains/identity/repositories/user.repository.js';
import { ErrorCodes } from '../errors/error-codes.js';
import { AppError } from '../errors/app-error.js';

export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(
                new AppError(ErrorCodes.AUTHENTICATION_REQUIRED, 401, 'Authentication required'),
            );
        }

        const token = authHeader.split(' ')[1];

        let decoded;
        try {
            decoded = tokenService.verifyAccessToken(token);
        } catch (error) {
            return next(error);
        }

        const user = await userRepository.findById(decoded.sub);

        if (!user) {
            return next(new AppError(ErrorCodes.INVALID_TOKEN, 401, 'User not found'));
        }

        if (!user.isActive) {
            return next(new AppError(ErrorCodes.ACCOUNT_INACTIVE, 403, 'Account is inactive'));
        }

        req.auth = {
            userId: user._id.toString(),
            role: user.role,
            user: {
                id: user._id.toString(),
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
            },
        };

        next();
    } catch (error) {
        next(error);
    }
};
