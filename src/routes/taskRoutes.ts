import express from "express";
import { body, param, query } from "express-validator";
import {
  createTask,
  getTasks,
  updateTaskStatus,
  deleteTask,
  updateTaskDetails,
  addComment,
} from "../controllers/taskController";
import { protect } from "../middlewares/authMiddleware";
import { TaskStatus } from "../models/Task";
import User from "../models/User";
import { paginationMiddleware } from "../middlewares/paginationMiddleware";

const router = express.Router();

// All task routes require login
router.use(protect);

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       required:
 *         - title
 *         - description
 *       properties:
 *         _id:
 *           type: string
 *           description: Auto-generated MongoDB ID
 *         title:
 *           type: string
 *           description: Task title
 *         description:
 *           type: string
 *           description: Task description
 *         status:
 *           type: string
 *           enum: [pending, in-progress, done]
 *           default: pending
 *         userId:
 *           type: string
 *           description: ID of user who owns the task
 *         collaborators:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs of users who can view and update the task
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags for categorizing tasks
 *         category:
 *           type: string
 *           description: Main category for task organization
 *           default: Uncategorized
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           default: medium
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         startedAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *         dueDate:
 *           type: string
 *           format: date-time
 *         estimatedTime:
 *           type: number
 *           description: Estimated time in minutes
 *         comments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               text:
 *                 type: string
 *               createdAt:
 *                 type: string
 *                 format: date-time
 */

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
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Accepted formats - ISO date string (YYYY-MM-DD) or DD-MM-YYYY
 *               estimatedTime:
 *                 type: number
 *                 description: Estimated time in minutes
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Tags for categorizing tasks
 *               category:
 *                 type: string
 *                 description: Main category for task organization
 *               collaborators:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: User IDs who can view and update the task
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
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("tags.*")
      .optional()
      .isString()
      .isLength({ max: 20 })
      .withMessage("Each tag must be 20 characters or less"),
    body("category")
      .optional()
      .isString()
      .isLength({ max: 30 })
      .withMessage("Category must be 30 characters or less"),
    body("collaborators")
      .optional()
      .custom((value) => {
        if (!Array.isArray(value)) {
          throw new Error("Collaborators must be an array");
        }
        if (value.length > 10) {
          throw new Error("Maximum 10 collaborators allowed");
        }
        return true;
      }),
    body("collaborators.*")
      .optional()
      .isMongoId()
      .withMessage("Each collaborator must be a valid MongoDB ID")
      .custom(async (value) => {
        const userExists = await User.findById(value);
        if (!userExists) {
          throw new Error(`Collaborator with ID ${value} does not exist`);
        }
        return true;
      }),
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, done]
 *         description: Filter by task status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by task priority
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated list of tags to filter by
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term to find in title or description
 *       - in: query
 *         name: isCollaborator
 *         schema:
 *           type: boolean
 *         description: When true, includes tasks where the user is a collaborator
 *       - in: query
 *         name: dueDateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tasks due on or after this date (YYYY-MM-DD)
 *       - in: query
 *         name: dueDateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tasks due on or before this date (YYYY-MM-DD)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, dueDate, priority]
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort direction (ascending or descending)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of tasks
 *       401:
 *         description: Not authorized
 */
router.get(
  "/",
  [
    query("tags")
      .optional()
      .isString()
      .withMessage("Tags must be a comma-separated string"),
    query("category")
      .optional()
      .isString()
      .withMessage("Category must be a string"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search term must be a string"),
    query("isCollaborator")
      .optional()
      .isBoolean()
      .withMessage("isCollaborator must be a boolean"),
    query("dueDateFrom")
      .optional()
      .isISO8601()
      .withMessage("dueDateFrom must be a valid date"),
    query("dueDateTo")
      .optional()
      .isISO8601()
      .withMessage("dueDateTo must be a valid date"),
  ],
  paginationMiddleware({ defaultLimit: 10, maxLimit: 50 }),
  getTasks
);

/**
 * @swagger
 * /tasks/{id}/status:
 *   patch:
 *     summary: Update a task's status
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
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
 *         description: Task ID
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

/**
 * @swagger
 * /tasks/{id}:
 *   patch:
 *     summary: Update task details
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 3
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               estimatedTime:
 *                 type: number
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               category:
 *                 type: string
 *               collaborators:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Task not found
 */
router.patch(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid task ID"),
    body("title")
      .optional()
      .trim()
      .isLength({ min: 3 })
      .withMessage("Title must be at least 3 characters long"),
    body("description")
      .optional()
      .trim()
      .not()
      .isEmpty()
      .withMessage("Description cannot be empty"),
    body("tags").optional().isArray().withMessage("Tags must be an array"),
    body("tags.*")
      .optional()
      .isString()
      .isLength({ max: 20 })
      .withMessage("Each tag must be 20 characters or less"),
    body("category")
      .optional()
      .isString()
      .isLength({ max: 30 })
      .withMessage("Category must be 30 characters or less"),
    body("collaborators")
      .optional()
      .custom((value) => {
        if (!Array.isArray(value)) {
          throw new Error("Collaborators must be an array");
        }
        if (value.length > 10) {
          throw new Error("Maximum 10 collaborators allowed");
        }
        return true;
      }),
    body("collaborators.*")
      .optional()
      .isMongoId()
      .withMessage("Each collaborator must be a valid MongoDB ID")
      .custom(async (value) => {
        const userExists = await User.findById(value);
        if (!userExists) {
          throw new Error(`Collaborator with ID ${value} does not exist`);
        }
        return true;
      }),
  ],
  updateTaskDetails
);

/**
 * @swagger
 * /tasks/{id}/comments:
 *   post:
 *     summary: Add a comment to a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Comment text
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Comment added successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Not authorized
 *       404:
 *         description: Task not found
 */
router.post(
  "/:id/comments",
  [
    param("id").isMongoId().withMessage("Invalid task ID"),
    body("text")
      .trim()
      .not()
      .isEmpty()
      .withMessage("Comment text is required")
      .isLength({ max: 500 })
      .withMessage("Comment must be 500 characters or less"),
  ],
  addComment
);

export default router;
