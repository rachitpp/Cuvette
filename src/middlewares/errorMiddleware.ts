import { Request, Response, NextFunction } from "express";
import { formatDbError } from "../utils/dbHelpers";

// AppError carries an HTTP status and operational flag
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Forward 404s to error handler
export const notFound = (req: Request, res: Response, next: NextFunction) =>
  next(new AppError(`Not found - ${req.originalUrl}`, 404));

// Global error handler
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    time: new Date().toISOString(),
  });

  let statusCode = 500;
  let message = "Server Error";
  const stack = process.env.NODE_ENV === "production" ? undefined : err.stack;
  let errorType = "ServerError";

  if ("statusCode" in err) {
    // our AppError
    statusCode = err.statusCode;
    message = err.message;
    errorType = "AppError";
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    message = formatDbError(err);
    errorType = "ValidationError";
  } else if (err.name === "MongoServerError") {
    statusCode = 400;
    message = formatDbError(err);
    errorType = "DatabaseError";
  } else if (
    err.name === "JsonWebTokenError" ||
    err.name === "TokenExpiredError"
  ) {
    statusCode = 401;
    message = "Invalid or expired token";
    errorType = "AuthError";
  } else if (err.name === "SyntaxError" && "body" in err) {
    statusCode = 400;
    message = "Invalid JSON";
    errorType = "SyntaxError";
  }

  if (process.env.NODE_ENV === "production" && statusCode >= 500) {
    message = "Server Error";
  }

  res.status(statusCode).json({
    message,
    type: errorType,
    stack,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
};

// Wrap async routes to catch errors
export const asyncHandler =
  (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
