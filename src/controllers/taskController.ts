import { Request, Response } from "express";
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Task, { TaskStatus } from "../models/Task";
import User from "../models/User";
import { withRetry, withTransaction, formatDbError } from "../utils/dbHelpers";

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
    const userId = req.query.userId || req.user?._id;
    const status = req.query.status as TaskStatus | undefined;
    const priority = req.query.priority as string | undefined;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const tags = req.query.tags
      ? (req.query.tags as string).split(",")
      : undefined;
    const category = req.query.category as string | undefined;
    const searchTerm = req.query.search as string | undefined;
    const isCollaborator = req.query.isCollaborator === "true";
    const dueDateFrom = req.query.dueDateFrom as string | undefined;
    const dueDateTo = req.query.dueDateTo as string | undefined;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (!userId) {
      res.status(400).json({ message: "User ID is required" });
      return;
    }

    const result = await withRetry(async () => {
      const userExists = await User.findById(userId);
      if (!userExists) throw new Error("User not found");

      const query: any = {};
      if (isCollaborator) {
        query.$or = [{ userId: userId }, { collaborators: userId }];
      } else {
        query.userId = userId;
      }
      if (status) query.status = status;
      if (priority) query.priority = priority;
      if (tags && tags.length > 0) {
        query.tags = { $in: tags };
      }
      if (category) query.category = category;
      if (searchTerm) {
        query.$or = [
          { title: { $regex: searchTerm, $options: "i" } },
          { description: { $regex: searchTerm, $options: "i" } },
        ];
      }
      if (dueDateFrom || dueDateTo) {
        query.dueDate = {};
        if (dueDateFrom) {
          query.dueDate.$gte = new Date(dueDateFrom);
        }
        if (dueDateTo) {
          query.dueDate.$lte = new Date(dueDateTo);
        }
      }

      const tasks = await Task.find(query)
        .populate("collaborators", "username email")
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit);

      const totalTasks = await Task.countDocuments(query);

      return {
        tasks,
        pagination: {
          totalTasks,
          totalPages: Math.ceil(totalTasks / limit),
          currentPage: page,
          hasNextPage: page * limit < totalTasks,
          hasPrevPage: page > 1,
        },
      };
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    const errorMessage = formatDbError(error);

    if (error.message.includes("User not found")) {
      res.status(404).json({ message: errorMessage });
    } else {
      res.status(500).json({ message: "Server error", error: errorMessage });
    }
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
