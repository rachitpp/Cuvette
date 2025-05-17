import { Request, Response, NextFunction } from "express";
import { rateLimit, Options } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "../config/redis";

// Define window durations in milliseconds
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

// Default rate limit options
const defaultRateLimitOptions: Partial<Options> = {
  windowMs: FIFTEEN_MINUTES,
  max: 1000, // Increased from 100 to 1000 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: "error",
    message: "Too many requests, please try again later.",
  },
  skip: (req: Request): boolean => {
    // Skip rate limiting for health check endpoints and in development
    return (
      req.path === "/health" ||
      req.path === "/api/health" ||
      process.env.NODE_ENV === "development"
    );
  },
};

// Create a function that will return a rate limiter
const createRateLimiter = (options: Partial<Options> = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limiterOptions: Partial<Options> = {
        ...defaultRateLimitOptions,
        ...options,
        store: new RedisStore({
          // @ts-ignore - Type definitions mismatch between redis and rate-limit-redis
          sendCommand: (...args: unknown[]) =>
            redisClient.sendCommand(args as any),
        }),
      };

      const limiter = rateLimit(limiterOptions);
      return limiter(req, res, next);
    } catch (error) {
      console.error("Rate limiter error:", error);
      // If rate limiting fails, continue without it
      next();
    }
  };
};

// API rate limiter - 1000 requests per 15 minutes
export const apiRateLimiter = createRateLimiter();

// Auth rate limiter - increased limit for auth endpoints (100 requests per hour)
export const authRateLimiter = createRateLimiter({
  windowMs: ONE_HOUR,
  max: 100, // Increased from 20 to 100
  message: {
    status: "error",
    message: "Too many login attempts, please try again later.",
  },
});

// Global error handler for rate limit errors
export const handleRateLimitError = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof Error && err.name === "RateLimitError") {
    res.status(429).json({
      status: "error",
      message: "Rate limit exceeded, please try again later.",
    });
    return;
  }
  next(err);
};
