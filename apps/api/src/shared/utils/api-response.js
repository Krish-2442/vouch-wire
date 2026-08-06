export const successResponse = (
    res,
    { data = {}, statusCode = 200, requestId, pagination } = {},
) => {
    const body = {
        success: true,
        data,
        meta: {
            requestId: requestId || res.getHeader('X-Request-Id'),
        },
    };

    if (pagination) {
        body.meta.pagination = pagination;
    }

    return res.status(statusCode).json(body);
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
