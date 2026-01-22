/**
 * =============================================================================
 * PRODUCTION-GRADE ERROR HANDLING
 * =============================================================================
 * 
 * Centralized error handling with proper logging and safe error responses.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../services/logger";

/**
 * Custom API Error class with status code and error code
 */
export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: any;
  public isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    code: string = "INTERNAL_ERROR",
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true; // Distinguishes from programming errors
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: any): ApiError {
    return new ApiError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(message: string = "Unauthorized"): ApiError {
    return new ApiError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message: string = "Forbidden"): ApiError {
    return new ApiError(403, message, "FORBIDDEN");
  }

  static notFound(resource: string = "Resource"): ApiError {
    return new ApiError(404, `${resource} not found`, "NOT_FOUND");
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message, "CONFLICT");
  }

  static tooManyRequests(message: string = "Too many requests"): ApiError {
    return new ApiError(429, message, "TOO_MANY_REQUESTS");
  }

  static internal(message: string = "Internal server error"): ApiError {
    return new ApiError(500, message, "INTERNAL_ERROR");
  }

  static immutableRecord(entityType: string): ApiError {
    return new ApiError(
      403,
      `${entityType} is closed and cannot be modified`,
      "IMMUTABLE_RECORD"
    );
  }
}

/**
 * Async handler wrapper to catch async errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route ${req.method} ${req.path}`));
}

/**
 * Global error handler middleware
 */
export function globalErrorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Default values
  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred";
  let details = undefined;

  // Handle ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }

  // Log the error
  const logData = {
    method: req.method,
    path: req.path,
    statusCode,
    code,
    message: err.message,
    stack: err.stack,
    body: req.body,
    query: req.query,
    params: req.params,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  };

  if (statusCode >= 500) {
    logger.error("Server error", logData);
  } else if (statusCode >= 400) {
    logger.warn("Client error", logData);
  }

  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === "production";
  
  const response: any = {
    error: message,
    code,
  };

  if (details && !isProduction) {
    response.details = details;
  }

  if (!isProduction && err.stack) {
    response.stack = err.stack;
  }

  // Prevent headers sent error
  if (res.headersSent) {
    return;
  }

  res.status(statusCode).json(response);
}

/**
 * Handles uncaught exceptions
 */
export function handleUncaughtException(error: Error) {
  logger.error("Uncaught exception", {
    message: error.message,
    stack: error.stack,
  });
  
  // Give logger time to write
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}

/**
 * Handles unhandled promise rejections
 */
export function handleUnhandledRejection(reason: any) {
  logger.error("Unhandled rejection", {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers() {
  process.on("uncaughtException", handleUncaughtException);
  process.on("unhandledRejection", handleUnhandledRejection);
}
