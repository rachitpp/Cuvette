import express, { Express, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import userRoutes from "./routes/userRoutes";
import taskRoutes from "./routes/taskRoutes";
import { connectDB } from "./config/database";
import { initRedis } from "./config/redis";
import { getDbStats, isDbConnected } from "./utils/dbHelpers";
import mongoose from "mongoose";
import { errorHandler, notFound } from "./middlewares/errorMiddleware";
import {
  apiRateLimiter,
  handleRateLimitError,
} from "./middlewares/rateLimitMiddleware";
import path from "path";

// Load env vars from .env file
dotenv.config();

// Set NODE_ENV to development if not set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
  console.log("NODE_ENV not set, defaulting to development");
}

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware for CORS, JSON, and URL-encoded parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting to all routes - only if not in development with no Redis
if (!(process.env.NODE_ENV === "development" && !process.env.REDIS_URL)) {
  try {
    app.use(apiRateLimiter);
    app.use(handleRateLimitError);
  } catch (error) {
    console.warn("Rate limiting could not be applied:", error);
  }
}

// Swagger API docs setup
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Task Management API",
      version: "1.0.0",
      description: "API for task management system",
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Expose raw swagger spec JSON
app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount API routes
app.use("/users", userRoutes);
app.use("/tasks", taskRoutes);

// Root route handler
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to Task Management API",
    version: "1.0.0",
    documentation: "/api-docs",
    healthCheck: "/health",
    apiEndpoints: {
      users: "/users",
      tasks: "/tasks",
    },
  });
});

// Prevent service worker 404 in browser console
app.get("/service-worker.js", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send("// empty service worker");
});

// Health check route for uptime, memory, DB
app.get("/health", (req: Request, res: Response) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  const dbStatus = getDbStats();

  res.status(200).json({
    status: "ok",
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    timestamp: new Date(),
    database: {
      connected: isDbConnected(),
      status: dbStatus.status === 1 ? "connected" : "disconnected",
      host: dbStatus.host,
      name: dbStatus.name,
      connectionCount: mongoose.connections.length,
    },
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
    },
  });
});

// Add a health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is healthy" });
});

// Serve frontend in production mode
if (process.env.NODE_ENV === "production") {
  const clientPath = path.join(__dirname, "../client/build");
  app.use(express.static(clientPath));

  // Support for client-side routing in SPA
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.url.startsWith("/api") || req.url === "/health") return next();
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

// Error middleware
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown handlers
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function shutdown() {
  console.log("Shutting down...");
  mongoose.connection
    .close()
    .then(() => {
      console.log("MongoDB connection closed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error during shutdown:", err);
      process.exit(1);
    });

  // Force exit if still hanging
  setTimeout(() => {
    console.error("Force shutdown after timeout");
    process.exit(1);
  }, 10000);
}

// Start server only if not in test mode
if (process.env.NODE_ENV !== "test") {
  const startServer = () => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Docs → http://localhost:${port}/api-docs`);
    });
  };

  // Connect to MongoDB first
  connectDB()
    .then(async () => {
      try {
        // Initialize Redis (will be mocked in development)
        await initRedis();
      } catch (error) {
        // In production, Redis failure is critical
        if (process.env.NODE_ENV === "production") {
          console.error("Failed to initialize Redis in production:", error);
          process.exit(1);
        }
        // In other environments, just log and continue
        console.warn("Redis initialization warning:", error);
      }

      // Start the server
      startServer();
    })
    .catch((error) => {
      console.error("Failed to connect to MongoDB:", error);
      process.exit(1);
    });
}

export { app };
