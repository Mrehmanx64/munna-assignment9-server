import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils";
import { ApiErrorResponse, ApiValidationErrorDetail, HttpStatus } from "../types";
import { env } from "../config/env";

interface MongoError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
  errors?: Record<string, { message: string; path: string }>;
  name: string;
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
  let message = "Internal server error";
  let errors: ApiValidationErrorDetail[] | null = null;
  let stack: string | undefined = undefined;

  // 1. ApiError (our custom operational errors)
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors ?? null;
    stack = err.stack;
  }
  // 2. Zod validation error
  else if (err instanceof ZodError) {
    statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
    message = "Request validation failed";
    errors = err.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    stack = err.stack;
  }
  // 3. Mongoose Validation / Cast / Duplicate errors
  else if (err && typeof err === "object") {
    const mongoErr = err as MongoError;

    // Mongoose Duplicate Key (E11000)
    if (mongoErr.code === 11000 && mongoErr.keyValue) {
      statusCode = HttpStatus.CONFLICT;
      const field = Object.keys(mongoErr.keyValue)[0] ?? "field";
      message = `Duplicate value entered for ${field}`;
      errors = [{ field, message: `${field} already exists` }];
      stack = mongoErr.stack;
    }
    // Mongoose Validation Error
    else if (mongoErr.name === "ValidationError" && mongoErr.errors) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = "Database validation failed";
      errors = Object.values(mongoErr.errors).map((val) => ({
        field: val.path,
        message: val.message,
      }));
      stack = mongoErr.stack;
    }
    // Mongoose CastError (e.g. invalid ObjectId)
    else if (mongoErr.name === "CastError") {
      statusCode = HttpStatus.BAD_REQUEST;
      message = "Invalid resource identifier format";
      stack = mongoErr.stack;
    }
    // JWT Errors
    else if (mongoErr.name === "JsonWebTokenError") {
      statusCode = HttpStatus.UNAUTHORIZED;
      message = "Invalid authorization token";
    } else if (mongoErr.name === "TokenExpiredError") {
      statusCode = HttpStatus.UNAUTHORIZED;
      message = "Authorization token has expired";
    }
    // Standard Javascript Error
    else if (err instanceof Error) {
      message = err.message || message;
      stack = err.stack;
    }
  }

  // Hide internal server error details in production
  if (env.NODE_ENV === "production" && statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
    message = "An unexpected error occurred on the server";
  }

  const response: ApiErrorResponse = {
    success: false,
    statusCode,
    message,
    errors,
    timestamp: new Date().toISOString(),
    ...(env.NODE_ENV === "development" && stack ? { stack } : {}),
  };

  res.status(statusCode).json(response);
};
