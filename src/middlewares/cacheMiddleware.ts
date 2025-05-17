import { Request, Response, NextFunction } from "express";
import redisClient from "../config/redis";

interface CacheOptions {
  duration: number; // Cache duration in seconds
  key?: string | ((req: Request) => string); // Custom key or key generator
  condition?: (req: Request) => boolean; // Condition to apply cache
}

const defaultOptions: CacheOptions = {
  duration: 300, // 5 minutes default
};

/**
 * Generate cache key from request
 */
const generateKey = (
  req: Request,
  keyPattern?: string | ((req: Request) => string)
): string => {
  if (typeof keyPattern === "function") {
    return keyPattern(req);
  }
  if (keyPattern) {
    return keyPattern;
  }
  // Default key pattern: method:path:query:auth
  const authKey = req.user ? `user:${req.user._id}` : "anonymous";
  return `cache:${req.method}:${req.path}:${JSON.stringify(
    req.query
  )}:${authKey}`;
};

/**
 * Cache middleware factory
 */
export const cache = (options: CacheOptions = defaultOptions) => {
  const { duration, key, condition } = { ...defaultOptions, ...options };

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Skip cache based on condition
    if (condition && !condition(req)) {
      return next();
    }

    const cacheKey = generateKey(req, key);

    try {
      // Try to get cached response
      const cachedResponse = await redisClient.get(cacheKey);

      if (cachedResponse) {
        console.log(`Cache hit for ${cacheKey}`);
        const { statusCode, data } = JSON.parse(cachedResponse);
        res.status(statusCode).json(data);
        return;
      }

      // Store original res.json to intercept response
      const originalJson = res.json.bind(res);
      res.json = ((data: any) => {
        // Store response in cache
        redisClient.setEx(
          cacheKey,
          duration,
          JSON.stringify({
            statusCode: res.statusCode,
            data,
          })
        );

        return originalJson(data);
      }) as any;

      next();
    } catch (error) {
      console.error("Cache error:", error);
      next();
    }
  };
};

/**
 * Cache invalidation middleware
 */
export const invalidateCache = (pattern: string) => {
  return async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      const keys = await redisClient.keys(`cache:${pattern}`);
      if (keys.length > 0) {
        await redisClient.del(keys);
        console.log(
          `Invalidated ${keys.length} cache entries matching ${pattern}`
        );
      }
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
    next();
  };
};

/**
 * Cache warmer utility
 */
export const warmCache = async (
  req: Request,
  key: string,
  duration: number
): Promise<void> => {
  try {
    const response = await fetch(
      `http://localhost:${process.env.PORT || 3000}${req.path}`
    );
    const data = await response.json();

    await redisClient.setEx(
      `cache:${key}`,
      duration,
      JSON.stringify({
        statusCode: response.status,
        data,
      })
    );

    console.log(`Warmed cache for ${key}`);
  } catch (error) {
    console.error("Cache warming error:", error);
  }
};
