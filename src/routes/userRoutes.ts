import express from "express";
import { body } from "express-validator";
import {
  registerUser,
  loginUser,
  getUserProfile,
} from "../controllers/userController";
import User, { UserRole } from "../models/User";
import { protect } from "../middlewares/authMiddleware";
import { authRateLimiter } from "../middlewares/rateLimitMiddleware";
import {
  requirePermission,
  requirePermissions,
  requireAnyPermission,
  auditLog,
} from "../middlewares/enhancedRbacMiddleware";
import { Permission } from "../types/permissions";
import { cache, invalidateCache } from "../middlewares/cacheMiddleware";
import { CacheService } from "../services/cacheService";
import { paginationMiddleware } from "../middlewares/paginationMiddleware";

const router = express.Router();
const cacheService = CacheService.getInstance();

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input
 */
router.post(
  "/",
  authRateLimiter,
  [
    body("username")
      .trim()
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters long"),
    body("email")
      .trim()
      .isEmail()
      .withMessage("Please enter a valid email address"),
    body("password")
      .trim()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  registerUser,
  invalidateCache("GET:users*") // Invalidate user-related caches on new registration
);

/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Login a user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post(
  "/login",
  authRateLimiter,
  [
    body("email")
      .trim()
      .isEmail()
      .withMessage("Please enter a valid email address"),
    body("password").trim().not().isEmpty().withMessage("Password is required"),
  ],
  loginUser
);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get the current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       401:
 *         description: Not authorized
 */
router.get(
  "/profile",
  protect,
  requirePermission(Permission.READ_PROFILE),
  cache({
    duration: 300, // 5 minutes
    key: (req) => `user:${req.user!._id}:profile`,
  }),
  getUserProfile
);

/**
 * @swagger
 * /users/all:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users with pagination
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Missing required permissions
 */
router.get(
  "/all",
  protect,
  requirePermission(Permission.READ_ALL_USERS),
  auditLog("Retrieved users list"),
  paginationMiddleware({ defaultLimit: 10, maxLimit: 50 }),
  cache({
    duration: 600,
    key: (req) =>
      `users:all:page${req.pagination.page}:limit${req.pagination.limit}`,
    condition: (req) => req.user?.role === UserRole.ADMIN,
  }),
  async (req, res) => {
    try {
      const total = await User.countDocuments();
      const users = await User.find()
        .select("-password")
        .skip(req.pagination.skip)
        .limit(req.pagination.limit);

      res.json({
        data: users,
        total,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

/**
 * @swagger
 * /users/stats:
 *   get:
 *     summary: Get user statistics (managers and admins only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
 *       401:
 *         description: Not authorized
 *       403:
 *         description: Forbidden - Missing required permissions
 */
router.get(
  "/stats",
  protect,
  requireAnyPermission([Permission.VIEW_METRICS, Permission.VIEW_TEAM_METRICS]),
  auditLog("Viewed user statistics"),
  cache({
    duration: 300, // 5 minutes
    key: "users:stats",
  }),
  async (req, res) => {
    try {
      const totalUsers = await User.countDocuments();
      const usersByRole = await User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]);

      res.json({
        totalUsers,
        usersByRole: usersByRole.reduce(
          (
            acc: Record<string, number>,
            curr: { _id: string; count: number }
          ) => {
            acc[curr._id] = curr.count;
            return acc;
          },
          {}
        ),
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Temporary debug endpoint
router.get("/debug-roles", async (req, res) => {
  try {
    const users = await User.find().select("email username role");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
});

// Temporary endpoint to clear rate limits
router.post("/debug-clear-limits", async (req, res) => {
  try {
    // Clear rate limit data
    await User.updateMany({}, { $set: { loginAttempts: 0 } });
    res.json({ message: "Rate limits cleared" });
  } catch (error) {
    res.status(500).json({ message: "Error clearing rate limits", error });
  }
});

// Cache management routes (admin only)
router.post(
  "/cache/clear",
  protect,
  requirePermission(Permission.READ_ALL_USERS),
  async (req, res) => {
    try {
      await cacheService.clearAll();
      res.json({ message: "Cache cleared successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error clearing cache" });
    }
  }
);

router.get(
  "/cache/stats",
  protect,
  requirePermission(Permission.READ_ALL_USERS),
  async (req, res) => {
    try {
      const stats = cacheService.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching cache stats" });
    }
  }
);

export default router;
