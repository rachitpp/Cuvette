import { Request, Response, NextFunction } from "express";

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    currentPage: number;
    totalPages: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const paginationMiddleware = (options: PaginationOptions = {}) => {
  const defaultLimit = options.defaultLimit || 10;
  const maxLimit = options.maxLimit || 100;

  return (req: Request, res: Response, next: NextFunction) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    let limit = Math.max(
      1,
      parseInt(req.query.limit as string) || defaultLimit
    );

    // Ensure limit doesn't exceed maxLimit
    limit = Math.min(limit, maxLimit);

    const skip = (page - 1) * limit;

    // Add pagination parameters to request object
    req.pagination = {
      page,
      limit,
      skip,
    };

    // Wrap res.json to include pagination metadata
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      if (body && Array.isArray(body.data) && typeof body.total === "number") {
        const totalPages = Math.ceil(body.total / limit);

        const paginatedResponse: PaginatedResponse<any> = {
          data: body.data,
          pagination: {
            total: body.total,
            currentPage: page,
            totalPages,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        };

        return originalJson.call(this, paginatedResponse);
      }

      return originalJson.call(this, body);
    };

    next();
  };
};

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      pagination: {
        page: number;
        limit: number;
        skip: number;
      };
    }
  }
}
