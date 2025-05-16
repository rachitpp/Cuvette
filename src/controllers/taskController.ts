import { Request, Response } from "express";
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import Task, { TaskStatus } from "../models/Task";
import User from "../models/User";

// @desc    Create a new task
// @route   POST /tasks
// @access  Private
export const createTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { title, description } = req.body;
    const userId = req.user?._id as mongoose.Types.ObjectId;

    // Check if user exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check for duplicate task title for the same user
    const taskExists = await Task.findOne({ title, userId });
    if (taskExists) {
      res
        .status(400)
        .json({ message: "Task with this title already exists for this user" });
      return;
    }

    // Create new task
    const task = await Task.create({
      title,
      description,
      userId,
      status: TaskStatus.PENDING,
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Get all tasks for a user
// @route   GET /tasks?userId=
// @access  Private
export const getTasks = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId || req.user?._id;

    if (!userId) {
      res.status(400).json({ message: "User ID is required" });
      return;
    }

    // Verify the requested userId exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get all tasks for the user
    const tasks = await Task.find({ userId }).sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Update task status
// @route   PATCH /tasks/:id/status
// @access  Private
export const updateTaskStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const taskId = req.params.id;
    const { status } = req.body;
    const userId = req.user?._id as mongoose.Types.ObjectId;

    // Check if task exists and belongs to user
    const task = await Task.findOne({ _id: taskId, userId });

    if (!task) {
      res.status(404).json({ message: "Task not found or not authorized" });
      return;
    }

    // Update task status
    task.status = status;

    // If status is DONE, add completedAt timestamp
    if (status === TaskStatus.DONE && !task.completedAt) {
      task.completedAt = new Date();
    }

    // If status is IN_PROGRESS, add startedAt timestamp
    if (status === TaskStatus.IN_PROGRESS && !task.startedAt) {
      task.startedAt = new Date();
    }

    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Delete a task
// @route   DELETE /tasks/:id
// @access  Private
export const deleteTask = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const taskId = req.params.id;
    const userId = req.user?._id as mongoose.Types.ObjectId;

    // Find task by id and user id
    const task = await Task.findOne({ _id: taskId, userId });

    if (!task) {
      res.status(404).json({ message: "Task not found or not authorized" });
      return;
    }

    // Delete task
    await Task.deleteOne({ _id: taskId });

    res.json({ message: "Task removed" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
