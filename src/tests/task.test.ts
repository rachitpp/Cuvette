// Setup mocks before imports to avoid reference errors
jest.mock("../config/database", () => ({
  connectDB: jest.fn().mockReturnValue(Promise.resolve()),
}));

// Mock Redis client
jest.mock("../config/redis", () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  quit: jest.fn().mockResolvedValue(undefined),
  connect: jest.fn().mockResolvedValue(undefined),
}));

// Mock auth middleware
jest.mock("../middlewares/authMiddleware", () => ({
  protect: jest.fn((req, _res, next) => {
    req.user = {
      _id: "507f1f77bcf86cd799439011",
      username: "testuser",
      email: "test@example.com",
      role: "user",
    };
    next();
  }),
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
import Task, { TaskStatus, ITask, TaskPriority } from "../models/Task";
import { IUser, UserRole } from "../models/User";

// Mock user for authentication
const mockUser = {
  _id: "507f1f77bcf86cd799439011",
  username: "testuser",
  email: "test@example.com",
  role: UserRole.USER,
};

const mockCollaborator = {
  _id: "507f1f77bcf86cd799439012",
  username: "collaborator",
  email: "collab@example.com",
  role: UserRole.USER,
};

// Mock task data
const createMockTask = () => ({
  _id: "507f1f77bcf86cd799439013",
  title: "Test Task",
  description: "Test Description",
  status: TaskStatus.PENDING,
  priority: TaskPriority.MEDIUM,
  userId: mockUser._id,
  collaborators: [],
  tags: ["test"],
  category: "testing",
  dueDate: new Date("2025-12-31"),
  estimatedTime: 60,
  comments: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockTask = createMockTask();

// Mock the Task model
jest.mock("../models/Task", () => {
  const originalModule = jest.requireActual("../models/Task");

  return {
    __esModule: true,
    default: {
      find: jest.fn().mockReturnThis(),
      findOne: jest.fn().mockReturnThis(),
      findById: jest.fn().mockReturnThis(),
      countDocuments: jest.fn().mockResolvedValue(1),
      create: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ ...createMockTask(), ...data })
        ),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      populate: jest
        .fn()
        .mockImplementation(() => Promise.resolve(createMockTask())),
      session: jest.fn().mockReturnThis(),
    },
    TaskStatus: originalModule.TaskStatus,
    TaskPriority: originalModule.TaskPriority,
  };
});

describe("Task API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  // Task Creation Tests
  describe("Task Creation", () => {
    it("should create a new task with valid data", async () => {
      const taskData = {
        title: "New Task",
        description: "Task Description",
        priority: "medium",
        dueDate: "2025-12-31",
        estimatedTime: 60,
        tags: ["test"],
        category: "testing",
      };

      const res = await request(app)
        .post("/tasks")
        .send(taskData)
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.title).toBe(taskData.title);
    });

    it("should return 400 for invalid task data", async () => {
      const invalidTask = {
        title: "a", // too short
        description: "",
      };

      const res = await request(app)
        .post("/tasks")
        .send(invalidTask)
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("errors");
    });
  });

  // Task Retrieval Tests
  describe("Task Retrieval", () => {
    it("should get tasks with pagination", async () => {
      const res = await request(app)
        .get("/tasks")
        .query({ page: 1, limit: 10 })
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("pagination");
      expect(res.body.pagination).toHaveProperty("total");
      expect(res.body.pagination).toHaveProperty("currentPage");
    });

    it("should filter tasks by status", async () => {
      const res = await request(app)
        .get("/tasks")
        .query({ status: TaskStatus.PENDING })
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it("should search tasks by title/description", async () => {
      const res = await request(app)
        .get("/tasks")
        .query({ search: "test" })
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // Task Update Tests
  describe("Task Updates", () => {
    it("should update task details", async () => {
      const updates = {
        title: "Updated Task",
        priority: "high",
      };

      const res = await request(app)
        .patch(`/tasks/${mockTask._id}`)
        .send(updates)
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(200);
      expect(res.body.title).toBe(updates.title);
    });

    it("should update task status", async () => {
      const res = await request(app)
        .patch(`/tasks/${mockTask._id}/status`)
        .send({ status: TaskStatus.IN_PROGRESS })
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it("should handle invalid status updates", async () => {
      const res = await request(app)
        .patch(`/tasks/${mockTask._id}/status`)
        .send({ status: "invalid-status" })
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(400);
    });
  });

  // Collaborator Tests
  describe("Task Collaborators", () => {
    it("should add collaborators to a task", async () => {
      const updates = {
        collaborators: [mockCollaborator._id],
      };

      const res = await request(app)
        .patch(`/tasks/${mockTask._id}`)
        .send(updates)
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(200);
      expect(res.body.collaborators).toContain(mockCollaborator._id);
    });

    it("should reject invalid collaborator IDs", async () => {
      const updates = {
        collaborators: ["invalid-id"],
      };

      const res = await request(app)
        .patch(`/tasks/${mockTask._id}`)
        .send(updates)
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(400);
    });
  });

  // Comment Tests
  describe("Task Comments", () => {
    it("should add a comment to a task", async () => {
      const comment = {
        text: "Test comment",
      };

      const res = await request(app)
        .post(`/tasks/${mockTask._id}/comments`)
        .send(comment)
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(201);
      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].text).toBe(comment.text);
    });

    it("should validate comment text", async () => {
      const res = await request(app)
        .post(`/tasks/${mockTask._id}/comments`)
        .send({ text: "" })
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(400);
    });
  });

  // Task Deletion Tests
  describe("Task Deletion", () => {
    it("should delete a task", async () => {
      const res = await request(app)
        .delete(`/tasks/${mockTask._id}`)
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/removed successfully/i);
    });

    it("should handle deletion of non-existent task", async () => {
      const res = await request(app)
        .delete("/tasks/nonexistentid123")
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(404);
    });
  });

  // Cache Tests
  describe("Task Caching", () => {
    it("should use cache for repeated task requests", async () => {
      // First request - should set cache
      await request(app)
        .get("/tasks")
        .set("Authorization", "Bearer test-token");

      // Second request - should use cache
      const res = await request(app)
        .get("/tasks")
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(200);
    });
  });

  // Authorization Tests
  describe("Task Authorization", () => {
    it("should prevent unauthorized task updates", async () => {
      // Mock user as non-owner
      const unauthorizedId = "differentuserid123";
      jest
        .spyOn(mongoose.Types, "ObjectId")
        .mockImplementation(() => unauthorizedId);

      const res = await request(app)
        .patch(`/tasks/differentuserid123`)
        .send({ title: "Unauthorized Update" })
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(404);
    });

    it("should allow collaborator to add comments", async () => {
      // Mock user as collaborator
      const taskWithCollaborator = {
        ...mockTask,
        collaborators: [mockCollaborator._id],
      } as ITask;

      const res = await request(app)
        .post(`/tasks/${taskWithCollaborator._id}/comments`)
        .send({ text: "Collaborator comment" })
        .set("Authorization", "Bearer test-token");

      expect(res.status).toBe(201);
    });
  });
});
