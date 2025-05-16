import mongoose from "mongoose";

// Config for retry logic
interface RetryConfig {
  maxRetries: number;
  retryInterval: number;
  retryableErrors: string[];
}

// Default settings
const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  retryInterval: 1000,
  retryableErrors: [
    "MongoNetworkError",
    "MongoTimeoutError",
    "MongoWriteConcernError",
    "MongoServerSelectionError",
  ],
};

// Run DB operation with retries
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...defaultRetryConfig, ...config };
  let lastError: any;

  for (let attempt = 1; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const isRetryable = finalConfig.retryableErrors.includes(error.name);

      if (isRetryable && attempt < finalConfig.maxRetries) {
        console.warn(
          `Retry ${attempt}/${finalConfig.maxRetries} failed: ${error.message}`
        );
        await new Promise((res) => setTimeout(res, finalConfig.retryInterval));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

// Run operations inside a transaction
export async function withTransaction<T>(
  operations: (session: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await operations(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Clean DB error messages for client responses
export const formatDbError = (error: any): string => {
  if (error.name === "ValidationError") {
    // Handle mongoose validation errors
    const errors = Object.values(error.errors).map((err: any) => {
      if (err.kind === "date" && err.path === "dueDate") {
        return `Invalid date format for dueDate. Use formats like YYYY-MM-DD or DD-MM-YYYY`;
      }
      return err.message;
    });
    return `Validation failed: ${errors.join(", ")}`;
  } else if (error.name === "CastError") {
    if (error.path === "dueDate" && error.kind === "date") {
      return `Invalid date format for dueDate. Use formats like YYYY-MM-DD or DD-MM-YYYY`;
    }
    return `Invalid ${error.path}: ${error.value}`;
  } else if (error.code === 11000) {
    // Handle duplicate key errors
    return "Duplicate key error. Record already exists.";
  } else {
    // Handle other database errors
    return error.message || "Database error occurred";
  }
};

// Check DB connection
export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// Get DB connection info
export function getDbStats() {
  return {
    isConnected: isDbConnected(),
    status: mongoose.connection.readyState,
    host: mongoose.connection.host,
    name: mongoose.connection.name,
  };
}
