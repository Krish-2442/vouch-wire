import { tokenService } from '../../domains/identity/services/token.service.js';
import { userRepository } from '../../domains/identity/repositories/user.repository.js';
import { ErrorCodes } from '../errors/error-codes.js';

export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const err = new Error('Authentication required');
            err.code = ErrorCodes.AUTHENTICATION_REQUIRED;
            err.statusCode = 401;
            return next(err);
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
            const err = new Error('User not found');
            err.code = ErrorCodes.INVALID_TOKEN;
            err.statusCode = 401;
            return next(err);
        }

        if (!user.isActive) {
            const err = new Error('Account is inactive');
            err.code = ErrorCodes.ACCOUNT_INACTIVE;
            err.statusCode = 403;
            return next(err);
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
