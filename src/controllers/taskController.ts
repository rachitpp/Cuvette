import { Request, Response } from "express";
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Task, { TaskStatus } from "../models/Task";
import User from "../models/User";
import { withRetry, withTransaction, formatDbError } from "../utils/dbHelpers";
import { paginationMiddleware } from "../middlewares/paginationMiddleware";

// Create a new task
export const createTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const {
      title,
      description,
      priority,
      dueDate,
      estimatedTime,
      tags,
      category,
      collaborators,
    } = req.body;

    const userId = req.user?._id as mongoose.Types.ObjectId;

    const task = await withRetry(async () => {
      const userExists = await User.findById(userId);
      if (!userExists) throw new Error("User not found");

      const taskExists = await Task.findOne({ title, userId });
      if (taskExists)
        throw new Error("Task with this title already exists for this user");

      if (collaborators && collaborators.length > 0) {
        const collaboratorCount = await User.countDocuments({
          _id: { $in: collaborators },
        });
        if (collaboratorCount !== collaborators.length) {
          throw new Error("One or more collaborators don't exist");
        }
      }

      return await Task.create({
        title,
        description,
        userId,
        status: TaskStatus.PENDING,
        priority: priority || undefined,
        dueDate: dueDate || undefined,
        estimatedTime: estimatedTime || undefined,
        tags: tags || [],
        category: category || "Uncategorized",
        collaborators: collaborators || [],
      });
    });

    res.status(201).json(task);
  } catch (error: any) {
    console.error("Error creating task:", error);
    const errorMessage = formatDbError(error);

    if (
      error.message.includes("already exists") ||
      error.name === "ValidationError"
    ) {
      res.status(400).json({ message: errorMessage });
    } else if (error.message.includes("User not found")) {
      res.status(404).json({ message: errorMessage });
    } else {
      res.status(500).json({ message: "Server error", error: errorMessage });
    }
  }
};

// Fetch tasks (owner or collaborator)
export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const userId = req.user?._id;
    const {
      status,
      priority,
      tags,
      category,
      search,
      isCollaborator,
      dueDateFrom,
      dueDateTo,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query: any = {};

    // Base conditions
    if (!isCollaborator || isCollaborator === "false") {
      query.userId = userId;
    } else {
      query.$or = [{ userId }, { collaborators: userId }];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Tags filter
    if (tags) {
      query.tags = { $in: (tags as string).split(",") };
    }

    // Category filter
    if (category) {
      query.category = category;
    }

    // Search in title and description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Due date range
    if (dueDateFrom || dueDateTo) {
      query.dueDate = {};
      if (dueDateFrom) {
        query.dueDate.$gte = new Date(dueDateFrom as string);
      }
      if (dueDateTo) {
        query.dueDate.$lte = new Date(dueDateTo as string);
      }
    }

    // Get total count for pagination
    const total = await Task.countDocuments(query);

    // Apply pagination
    const { page = 1, limit = 10 } = req.pagination || {};
    const skip = (page - 1) * limit;

    // Execute query with pagination
    const tasks = await Task.find(query)
      .sort({ [sortBy as string]: sortOrder === "asc" ? 1 : -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "username email")
      .populate("collaborators", "username email");

    res.json({
      data: tasks,
      total,
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Error fetching tasks" });
  }
};

// Change task status (owner or collaborator)
export const updateTaskStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const taskId = req.params.id;
    const { status } = req.body;
    const userId = req.user?._id as mongoose.Types.ObjectId;

    const task = await withTransaction(async (session) => {
      const task = await Task.findOne({
        _id: taskId,
        $or: [{ userId }, { collaborators: userId }],
      }).session(session);
      if (!task) throw new Error("Task not found or not authorized");

      task.status = status;
      if (status === TaskStatus.DONE && !task.completedAt) {
        task.completedAt = new Date();
      }
      if (status === TaskStatus.IN_PROGRESS && !task.startedAt) {
        task.startedAt = new Date();
      }
      if (status !== TaskStatus.DONE && task.completedAt) {
        task.completedAt = undefined;
      }

      await task.save({ session });
      return task;
    });

    res.json(task);
  } catch (error: any) {
    console.error("Error updating task status:", error);
    const errorMessage = formatDbError(error);

    if (
      error.message.includes("not found") ||
      error.message.includes("not authorized")
    ) {
      res.status(404).json({ message: errorMessage });
    } else if (error.name === "ValidationError") {
      res.status(400).json({ message: errorMessage });
    } else {
      res.status(500).json({ message: "Server error", error: errorMessage });
    }
  }
};

// Remove a task (owner only)
export const deleteTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const taskId = req.params.id;
    const userId = req.user?._id as mongoose.Types.ObjectId;

    await withTransaction(async (session) => {
      const task = await Task.findOne({
        _id: taskId,
        userId,
      }).session(session);
      if (!task) throw new Error("Task not found or not authorized");

      await Task.deleteOne({ _id: taskId }).session(session);
    });

    res.json({ message: "Task removed successfully" });
  } catch (error: any) {
    console.error("Error deleting task:", error);
    const errorMessage = formatDbError(error);

    if (
      error.message.includes("not found") ||
      error.message.includes("not authorized")
    ) {
      res.status(404).json({ message: errorMessage });
    } else {
      res.status(500).json({ message: "Server error", error: errorMessage });
    }
  }
};

// Update task details (owner only)
export const updateTaskDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const taskId = req.params.id;
    const userId = req.user?._id as mongoose.Types.ObjectId;
    const {
      tags,
      category,
      collaborators,
      title,
      description,
      priority,
      dueDate,
      estimatedTime,
    } = req.body;

    const task = await withTransaction(async (session) => {
      const task = await Task.findOne({ _id: taskId, userId }).session(session);
      if (!task) throw new Error("Task not found or not authorized");

      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (priority !== undefined) task.priority = priority;
      if (dueDate !== undefined) task.dueDate = dueDate;
      if (estimatedTime !== undefined) task.estimatedTime = estimatedTime;
      if (tags !== undefined) task.tags = tags;
      if (category !== undefined) task.category = category;

      if (collaborators !== undefined) {
        if (collaborators.length > 0) {
          const count = await User.countDocuments({
            _id: { $in: collaborators },
          }).session(session);
          if (count !== collaborators.length) {
            throw new Error("One or more collaborators don't exist");
          }
        }
        task.collaborators = collaborators;
      }

      await task.save({ session });
      await task.populate("collaborators", "username email");
      return task;
    });

    res.json(task);
  } catch (error: any) {
    console.error("Error updating task details:", error);
    const errorMessage = formatDbError(error);

    if (
      error.message.includes("not found") ||
      error.message.includes("not authorized")
    ) {
      res.status(404).json({ message: errorMessage });
    } else if (
      error.name === "ValidationError" ||
      error.message.includes("don't exist")
    ) {
      res.status(400).json({ message: errorMessage });
    } else {
      res.status(500).json({ message: "Server error", error: errorMessage });
    }
  }
};

// Add a comment to a task (owner or collaborator)
export const addComment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const taskId = req.params.id;
    const userId = req.user?._id as mongoose.Types.ObjectId;
    const { text } = req.body;

    const task = await withTransaction(async (session) => {
      const task = await Task.findOne({
        _id: taskId,
        $or: [{ userId }, { collaborators: userId }],
      }).session(session);
      if (!task) throw new Error("Task not found or not authorized");

      task.comments.push({
        userId: userId as unknown as mongoose.Schema.Types.ObjectId,
        text,
        createdAt: new Date(),
      });

      await task.save({ session });
      await task.populate("comments.userId", "username email");
      return task;
    });

    res.status(201).json(task);
  } catch (error: any) {
    console.error("Error adding comment:", error);
    const errorMessage = formatDbError(error);

    if (
      error.message.includes("not found") ||
      error.message.includes("not authorized")
    ) {
      res.status(404).json({ message: errorMessage });
    } else if (error.name === "ValidationError") {
      res.status(400).json({ message: errorMessage });
    } else {
      res.status(500).json({ message: "Server error", error: errorMessage });
    }
  }
};
