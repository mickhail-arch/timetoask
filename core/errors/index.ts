// core/errors/index.ts — Application errors and error codes

export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  FREE_LIMIT_EXHAUSTED: 'FREE_LIMIT_EXHAUSTED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  LLM_UNAVAILABLE: 'LLM_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly statusCode: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, 401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(ErrorCode.FORBIDDEN, 403, message);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation error') {
    super(ErrorCode.VALIDATION_ERROR, 400, message);
    this.name = 'ValidationError';
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message = 'Insufficient balance') {
    super(ErrorCode.INSUFFICIENT_BALANCE, 402, message);
    this.name = 'InsufficientBalanceError';
  }
}

export class FreeLimitExhaustedError extends AppError {
  constructor(message = 'Free usage limit exhausted') {
    super(ErrorCode.FREE_LIMIT_EXHAUSTED, 402, message);
    this.name = 'FreeLimitExhaustedError';
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(ErrorCode.TOO_MANY_REQUESTS, 429, message);
    this.name = 'TooManyRequestsError';
  }
}

export class LlmUnavailableError extends AppError {
  constructor(message = 'LLM service unavailable') {
    super(ErrorCode.LLM_UNAVAILABLE, 503, message);
    this.name = 'LlmUnavailableError';
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(ErrorCode.INTERNAL_ERROR, 500, message);
    this.name = 'InternalError';
  }
}
