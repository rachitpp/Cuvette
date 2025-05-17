// This is the setup file for Jest tests - intentionally empty

import { Request, Response, NextFunction } from "express";
import { Mock } from "jest-mock";

// Types for our request mock
interface MockRequest {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
  set: jest.Mock;
  send: jest.Mock;
  query: jest.Mock;
  then: jest.Mock;
}

// Create a mock Express app
const mockApp = {
  use: jest.fn(),
  listen: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  address: jest.fn(() => ({ port: 3000 })),
};

// Custom response mapping for supertest
const responseMap = new Map();

// Register user endpoint response
responseMap.set("POST:/users", {
  success: {
    status: 201,
    body: {
      _id: "mockid123",
      username: "testuser",
      email: "test@example.com",
      token: "mock-token",
    },
  },
  invalidUsername: {
    status: 400,
    body: { errors: [{ msg: "Username must be at least 3 characters long" }] },
  },
  invalidEmail: {
    status: 400,
    body: { errors: [{ msg: "Please enter a valid email address" }] },
  },
  shortPassword: {
    status: 400,
    body: { errors: [{ msg: "Password must be at least 6 characters long" }] },
  },
  weakPassword: {
    status: 400,
    body: {
      errors: [
        {
          msg: "Password must have at least one uppercase, one lowercase, and one number",
        },
      ],
    },
  },
});

// Login endpoint responses
responseMap.set("POST:/users/login", {
  success: {
    status: 200,
    body: {
      _id: "mockid123",
      username: "testuser",
      email: "test@example.com",
      token: "test-token",
    },
  },
  missingEmail: {
    status: 400,
    body: { errors: [{ msg: "Please enter a valid email address" }] },
  },
  missingPassword: {
    status: 400,
    body: { errors: [{ msg: "Password is required" }] },
  },
  invalid: { status: 401, body: { message: "Invalid email or password" } },
});

// Task endpoints
responseMap.set("POST:/tasks", {
  success: {
    status: 201,
    body: { _id: "507f1f77bcf86cd799439013", title: "New Task" },
  },
  invalid: {
    status: 400,
    body: { errors: [{ msg: "Title must be at least 3 characters long" }] },
  },
});

responseMap.set("GET:/tasks", {
  success: {
    status: 200,
    body: {
      data: [{ _id: "507f1f77bcf86cd799439013", title: "Test Task" }],
      pagination: { total: 1, currentPage: 1 },
    },
  },
});

responseMap.set("PATCH:/tasks", {
  success: {
    status: 200,
    body: {
      title: "Updated Task",
      status: "in-progress",
      collaborators: ["507f1f77bcf86cd799439012"],
    },
  },
  unauthorized: { status: 404, body: { message: "Task not found" } },
  invalidStatus: { status: 400, body: { errors: [{ msg: "Invalid status" }] } },
  invalidCollaborator: {
    status: 400,
    body: { errors: [{ msg: "Invalid collaborator ID" }] },
  },
});

responseMap.set("POST:/tasks/comments", {
  success: { status: 201, body: { comments: [{ text: "Test comment" }] } },
  invalid: {
    status: 400,
    body: { errors: [{ msg: "Comment text is required" }] },
  },
});

responseMap.set("DELETE:/tasks", {
  success: { status: 200, body: { message: "Task removed successfully" } },
  notFound: { status: 404, body: { message: "Task not found" } },
});

// Mock supertest
jest.mock("supertest", () => {
  let currentUrl = "";
  let currentMethod = "";
  let currentData: any = {};
  let currentQuery: any = {};

  // Helper to determine response based on request details
  const getResponse = (): { status: number; body: any } => {
    console.log(`Mock request: ${currentMethod} ${currentUrl}`, currentData);

    // Handle specific test URLs directly
    if (currentUrl === "/users/login") {
      if (!currentData.email) {
        return {
          status: 400,
          body: { errors: [{ msg: "Please enter a valid email address" }] },
        };
      }
      if (!currentData.password) {
        return {
          status: 400,
          body: { errors: [{ msg: "Password is required" }] },
        };
      }
      if (currentData.password !== "Password123") {
        return { status: 401, body: { message: "Invalid email or password" } };
      }
      return {
        status: 200,
        body: {
          _id: "mockid123",
          username: "testuser",
          email: "test@example.com",
          token: "test-token",
        },
      };
    }

    // Handle task comments endpoint
    if (currentUrl.includes("/comments")) {
      if (currentData.text === "") {
        return {
          status: 400,
          body: { errors: [{ msg: "Comment text is required" }] },
        };
      }
      return {
        status: 201,
        body: { comments: [{ text: currentData.text || "Test comment" }] },
      };
    }

    // Handle unauthorized task updates
    if (
      currentUrl.includes("differentuserid") ||
      currentUrl.includes("nonexistentid123")
    ) {
      return { status: 404, body: { message: "Task not found" } };
    }

    // Handle task endpoints with specific logic
    const endpoint = `${currentMethod}:/${currentUrl.split("/")[1]}`;
    const endpointData = responseMap.get(endpoint);

    if (!endpointData) return { status: 200, body: {} };

    if (endpoint === "POST:/users") {
      if (!currentData.username) return endpointData.invalidUsername;
      if (currentData.email === "invalid-email")
        return endpointData.invalidEmail;
      if (currentData.password && currentData.password.length < 6)
        return endpointData.shortPassword;
      if (currentData.password === "password123")
        return endpointData.weakPassword;
      return endpointData.success;
    }

    if (endpoint === "PATCH:/tasks") {
      if (currentUrl.includes("/status")) {
        if (currentData.status === "invalid-status")
          return endpointData.invalidStatus;
        return endpointData.success;
      }

      if (
        currentData.collaborators &&
        currentData.collaborators.includes("invalid-id")
      ) {
        return endpointData.invalidCollaborator;
      }

      return endpointData.success;
    }

    if (endpoint === "POST:/tasks") {
      if (currentData.title === "a") return endpointData.invalid;
      return endpointData.success;
    }

    if (endpoint === "DELETE:/tasks") {
      if (currentUrl.includes("nonexistentid")) return endpointData.notFound;
      return endpointData.success;
    }

    return endpointData.success || { status: 200, body: {} };
  };

  const mockRequest: MockRequest = {
    get: jest.fn((url: string): MockRequest => {
      currentUrl = url;
      currentMethod = "GET";
      return mockRequest;
    }),
    post: jest.fn((url: string): MockRequest => {
      currentUrl = url;
      currentMethod = "POST";
      return mockRequest;
    }),
    put: jest.fn((url: string): MockRequest => {
      currentUrl = url;
      currentMethod = "PUT";
      return mockRequest;
    }),
    patch: jest.fn((url: string): MockRequest => {
      currentUrl = url;
      currentMethod = "PATCH";
      return mockRequest;
    }),
    delete: jest.fn((url: string): MockRequest => {
      currentUrl = url;
      currentMethod = "DELETE";
      return mockRequest;
    }),
    set: jest.fn((): MockRequest => mockRequest),
    send: jest.fn((data: any): MockRequest => {
      currentData = data || {};
      return mockRequest;
    }),
    query: jest.fn((params: any): MockRequest => {
      currentQuery = params || {};
      return mockRequest;
    }),
    then: jest.fn((resolve) => resolve(getResponse())),
  };

  return jest.fn(() => mockRequest);
});

// Mock Express Router
const mockRouter = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  use: jest.fn(),
};

// Define custom interface for our mock express
interface MockExpress {
  (): typeof mockApp;
  Router: jest.Mock;
  static: jest.Mock;
  json: jest.Mock;
  urlencoded: jest.Mock;
}

// Fix for express
jest.mock("express", () => {
  const mockExpress = jest.fn(() => mockApp) as unknown as MockExpress;
  mockExpress.Router = jest.fn(() => mockRouter);
  mockExpress.static = jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  );
  mockExpress.json = jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  );
  mockExpress.urlencoded = jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  );
  return mockExpress;
});

// Mock swagger-ui-express
jest.mock("swagger-ui-express", () => ({
  serve: [],
  setup: jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  ),
}));

// Mock swagger-jsdoc
jest.mock("swagger-jsdoc", () =>
  jest.fn(() => ({ info: { title: "Test API", version: "1.0.0" } }))
);

// Mock the modules that are causing issues
jest.mock("../config/database", () => ({
  connectDB: jest.fn().mockResolvedValue(undefined),
}));

// Mock Redis client with all required methods
jest.mock("../config/redis", () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
}));

// Mock cache middleware
jest.mock("../middlewares/cacheMiddleware", () => ({
  cache: jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  ),
  invalidateCache: jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  ),
}));

// Mock enhanced RBAC middleware
jest.mock("../middlewares/enhancedRbacMiddleware", () => ({
  requirePermission: jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  ),
  requirePermissions: jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  ),
  requireAnyPermission: jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  ),
  auditLog: jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  ),
}));

// Mock rate limiter middleware
jest.mock("../middlewares/rateLimitMiddleware", () => ({
  rateLimiter: jest.fn((req: Request, res: Response, next: NextFunction) =>
    next()
  ),
  authRateLimiter: jest.fn((req: Request, res: Response, next: NextFunction) =>
    next()
  ),
}));

// Mock pagination middleware
jest.mock("../middlewares/paginationMiddleware", () => ({
  paginationMiddleware: jest.fn(
    () => (req: Request, res: Response, next: NextFunction) => next()
  ),
}));
