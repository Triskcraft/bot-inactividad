export class AppError extends Error {
    statusCode: number

    constructor(
        message: string,
        statusCode = 500,
        cause: Record<string, unknown> = {},
    ) {
        super(message, { cause })
        this.statusCode = statusCode
    }
}

export class BadRequestError extends AppError {
    constructor(message: string, cause: Record<string, unknown> = {}) {
        super(message, 400, { cause })
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', cause: Record<string, unknown> = {}) {
        super(message, 401, { cause })
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', cause: Record<string, unknown> = {}) {
        super(message, 403, { cause })
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'NotFound', cause: Record<string, unknown> = {}) {
        super(message, 404, { cause })
    }
}

export class InternalServerError extends AppError {
    constructor(
        message = 'Internal Server Error',
        cause: Record<string, unknown> = {},
    ) {
        super(message, 500, { cause })
    }
}
