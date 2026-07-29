export const successResponse = (res, { data = {}, statusCode = 200, requestId } = {}) => {
    return res.status(statusCode).json({
        success: true,
        data,
        meta: {
            requestId: requestId || res.getHeader('X-Request-Id'),
        },
    });
};

export const errorResponse = (
    res,
    { code, message, details = [], statusCode = 500, requestId } = {},
) => {
    return res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            details,
        },
        meta: {
            requestId: requestId || res.getHeader('X-Request-Id'),
        },
    });
};
