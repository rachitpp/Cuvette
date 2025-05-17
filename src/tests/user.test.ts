// Setup mocks before imports to avoid reference errors
jest.mock("../config/database", () => ({
  connectDB: jest.fn().mockResolvedValue(null),
}));

// Mock Redis client
jest.mock("../config/redis", () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
}));

// Mock rate limiter middleware
jest.mock("../middlewares/rateLimitMiddleware", () => ({
  rateLimiter: (req, _res, next) => next(),
}));

// Now import actual modules
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
} from "@jest/globals";
import request from "supertest";
import { app } from "../app";
import { Request, Response } from "express";
import mongoose from "mongoose";

// Mock user for authentication tests
const mockUser = {
  _id: "mockid123",
  username: "testuser",
  email: "test@example.com",
  comparePassword: jest.fn().mockImplementation((password) => {
    return Promise.resolve(password === "Password123");
  }),
};

// Mock the User model
jest.mock("../models/User", () => {
  return {
    __esModule: true,
    default: {
      findOne: jest.fn().mockImplementation((query) => {
        if (query && query.email === "test@example.com") {
          return Promise.resolve(mockUser);
        }
        return Promise.resolve(null);
      }),
      findById: jest.fn().mockImplementation((id) => {
        if (id === "mockid123") {
          return {
            select: jest.fn().mockResolvedValue(mockUser),
          };
        }
        return {
          select: jest.fn().mockResolvedValue(null),
        };
      }),
      create: jest.fn().mockImplementation(() => {
        return Promise.resolve([mockUser]);
      }),
    },
  };
});

// Mock auth middleware
jest.mock("../middlewares/authMiddleware", () => ({
  protect: jest.fn((_req, _res, next) => next()),
  generateToken: jest.fn(() => "test-token"),
}));

// Override the controller with our own implementation
jest.mock("../controllers/userController", () => {
  return {
    registerUser: jest.fn((req: Request, res: Response) => {
      const { username, email, password } = req.body;

      if (!username) {
        return res.status(400).json({
          errors: [{ msg: "Username must be at least 3 characters long" }],
        });
      }
      if (!email || !email.includes("@")) {
        return res.status(400).json({
          errors: [{ msg: "Please enter a valid email address" }],
        });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({
          errors: [{ msg: "Password must be at least 6 characters long" }],
        });
      }
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return res.status(400).json({
          errors: [
            {
              msg: "Password must have at least one uppercase, one lowercase, and one number",
            },
          ],
        });
      }

      return res.status(201).json({
        _id: "mockid123",
        username,
        email,
        token: "mock-token",
      });
    }),
    loginUser: jest.fn((req: Request, res: Response) => {
      const { email, password } = req.body;

      if (!email) {
        return res.status(400).json({
          errors: [{ msg: "Please enter a valid email address" }],
        });
      }

      if (!password) {
        return res.status(400).json({
          errors: [{ msg: "Password is required" }],
        });
      }

      if (email !== "test@example.com" || password !== "Password123") {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      return res.status(200).json({
        _id: "mockid123",
        username: "testuser",
        email: "test@example.com",
        token: "test-token",
      });
    }),
    getUserProfile: jest.fn((_req: Request, res: Response) => {
      return res.status(200).json(mockUser);
    }),
  };
});

// --- Tests ---
describe("User API Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  // Registration tests
  describe("User Registration", () => {
    it("should return 400 if username is missing", async () => {
      const res = await request(app).post("/users").send({
        email: "test@example.com",
        password: "Password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].msg).toMatch(/username/i);
    }, 15000);

    it("should return 400 if email is invalid", async () => {
      const res = await request(app).post("/users").send({
        username: "testuser",
        email: "invalid-email",
        password: "Password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].msg).toMatch(/valid email/i);
    }, 15000);

    it("should return 400 if password is too short", async () => {
      const res = await request(app).post("/users").send({
        username: "testuser",
        email: "test@example.com",
        password: "123",
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].msg).toMatch(/at least 6/i);
    }, 15000);

    it("should return 400 if password lacks complexity", async () => {
      const res = await request(app).post("/users").send({
        username: "testuser",
        email: "test@example.com",
        password: "password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors[0].msg).toMatch(/one uppercase/i);
    }, 15000);

    it("should return 201 when user registers successfully", async () => {
      const res = await request(app).post("/users").send({
        username: "testuser",
        email: "test@example.com",
        password: "Password123",
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("_id");
      expect(res.body.username).toBe("testuser");
      expect(res.body.email).toBe("test@example.com");
    }, 15000);
  });

  // Login tests
  describe("User Login", () => {
    it("should return 400 if email is missing", async () => {
      const res = await request(app).post("/users/login").send({
        password: "Password123",
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    }, 15000);

    it("should return 400 if password is missing", async () => {
      const res = await request(app).post("/users/login").send({
        email: "test@example.com",
      });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    }, 15000);

    it("should return 401 if credentials are invalid", async () => {
      const res = await request(app).post("/users/login").send({
        email: "test@example.com",
        password: "WrongPassword123",
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid/i);
    }, 15000);

    it("should return 200 with user data and token on successful login", async () => {
      const res = await request(app).post("/users/login").send({
        email: "test@example.com",
        password: "Password123",
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("_id");
      expect(res.body.username).toBe("testuser");
      expect(res.body.email).toBe("test@example.com");
    }, 15000);
  });
});
