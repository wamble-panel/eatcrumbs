export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`)
  }
}

export class UnauthorizedError extends AppError {
  constructor(msg = 'Unauthorized') {
    super(401, msg, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(msg = 'Forbidden') {
    super(403, msg, 'FORBIDDEN')
  }
}

export class ValidationError extends AppError {
  constructor(msg: string) {
    super(400, msg, 'VALIDATION_ERROR')
  }
}

export class ConflictError extends AppError {
  constructor(msg: string) {
    super(409, msg, 'CONFLICT')
  }
}
