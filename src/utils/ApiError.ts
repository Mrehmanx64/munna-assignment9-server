import { HttpStatus, ApiValidationErrorDetail } from "../types";

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: ApiValidationErrorDetail[] | null;

  constructor(
    statusCode: number,
    message: string,
    errors: ApiValidationErrorDetail[] | null = null,
    isOperational = true,
    stack = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(message = "Bad request", errors: ApiValidationErrorDetail[] | null = null): ApiError {
    return new ApiError(HttpStatus.BAD_REQUEST, message, errors);
  }

  static unauthorized(message = "Unauthorized access"): ApiError {
    return new ApiError(HttpStatus.UNAUTHORIZED, message);
  }

  static forbidden(message = "Forbidden resource"): ApiError {
    return new ApiError(HttpStatus.FORBIDDEN, message);
  }

  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(HttpStatus.NOT_FOUND, message);
  }

  static conflict(message = "Resource conflict"): ApiError {
    return new ApiError(HttpStatus.CONFLICT, message);
  }

  static unprocessableEntity(
    message = "Unprocessable entity",
    errors: ApiValidationErrorDetail[] | null = null
  ): ApiError {
    return new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, message, errors);
  }

  static internal(message = "Internal server error"): ApiError {
    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, message, null, false);
  }
}
