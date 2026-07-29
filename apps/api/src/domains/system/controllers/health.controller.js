import { checkLiveness, checkReadiness } from '../services/health.service.js';
import { successResponse, errorResponse } from '../../../shared/utils/api-response.js';
import { ErrorCodes } from '../../../shared/errors/error-codes.js';
import { asyncHandler } from '../../../shared/utils/async-handler.js';

export const getLiveness = (_req, res) => {
    const data = checkLiveness();
    return successResponse(res, { data });
};

export const getReadiness = asyncHandler(async (req, res) => {
    const result = await checkReadiness();

    if (!result.ready) {
        return errorResponse(res, {
            code: ErrorCodes.SERVICE_UNAVAILABLE,
            message: result.reason,
            statusCode: 503,
            requestId: req.id,
        });
    }

    return successResponse(res, { data: result });
});
