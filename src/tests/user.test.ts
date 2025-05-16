import request from "supertest";
import mongoose from "mongoose";
import { app } from "../app";
import { connectDB } from "../config/database";
import User from "../models/User";

// Test data
const testUser = {
  username: "testuser",
  email: "test@example.com",
  password: "password123",
};

// Connect to test database before all tests
beforeAll(async () => {
  // Use a test database
  process.env.MONGODB_URI = "mongodb://localhost:27017/task-management-test";
  process.env.NODE_ENV = "test";

  await connectDB();
});

// Clean up after all tests
afterAll(async () => {
  // Drop the test database
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});

// Clear users collection before each test
beforeEach(async () => {
  await User.deleteMany({});
});

describe("User Registration", () => {
  it("should register a new user successfully", async () => {
    const response = await request(app).post("/users").send(testUser);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("token");
    expect(response.body).toHaveProperty("_id");
    expect(response.body.username).toBe(testUser.username);
    expect(response.body.email).toBe(testUser.email);
    expect(response.body).not.toHaveProperty("password");

    // Verify the user is actually created in the database
    const userInDb = await User.findOne({ email: testUser.email });
    expect(userInDb).toBeTruthy();
    expect(userInDb?.username).toBe(testUser.username);
  });

  it("should not register a user with an existing email", async () => {
    // First create a user
    await User.create(testUser);

    // Try to register with the same email
    const response = await request(app).post("/users").send(testUser);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("message");
    expect(response.body.message).toContain("exists");
  });

  it("should validate the request body", async () => {
    // Missing username
    const response = await request(app).post("/users").send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("errors");
  });
});
