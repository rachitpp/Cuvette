import express from "express";
import { body, param } from "express-validator";
import {
  createTask,
  getTasks,
  updateTaskStatus,
  deleteTask,
} from "../controllers/taskController";
import { protect } from "../middlewares/authMiddleware";
import { TaskStatus } from "../models/Task";

const router = express.Router();

// All task routes require authentication
router.use(protect);

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Task created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authorized
 */
router.post(
  "/",
  [
    body("title")
      .trim()
      .isLength({ min: 3 })
      .withMessage("Title must be at least 3 characters long"),
    body("description")
      .trim()
      .not()
      .isEmpty()
      .withMessage("Description is required"),
  ],
  createTask
);

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks for a user
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: The user ID (optional, defaults to authenticated user)
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
 *       401:
 *         description: Not authorized
 */
router.get("/", getTasks);

/**
 * @swagger
 * /tasks/{id}/status:
 *   patch:
 *     summary: Update task status
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, done]
 *     responses:
 *       200:
 *         description: Task status updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Task not found
 */
router.patch(
  "/:id/status",
  [
    param("id").isMongoId().withMessage("Invalid task ID"),
    body("status")
      .isIn(Object.values(TaskStatus))
      .withMessage(
        `Status must be one of: ${Object.values(TaskStatus).join(", ")}`
      ),
  ],
  updateTaskStatus
);

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The task ID
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Task not found
 */
router.delete(
  "/:id",
  param("id").isMongoId().withMessage("Invalid task ID"),
  deleteTask
);

export default router;
