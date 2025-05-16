import { Request, Response } from "express";
import { validationResult } from "express-validator";
import User, { IUser } from "../models/User";
import { generateToken } from "../middlewares/authMiddleware";
import mongoose from "mongoose";

// @desc    Register a new user
// @route   POST /users
// @access  Public
export const registerUser = async (
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

    const { username, email, password } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (userExists) {
      res.status(400).json({ message: "User already exists" });
      return;
    }

    // Create new user
    const user = await User.create({
      username,
      email,
      password,
    });

    if (user) {
      const userId = user._id as mongoose.Types.ObjectId;
      res.status(201).json({
        _id: userId,
        username: user.username,
        email: user.email,
        token: generateToken(userId.toString()),
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Authenticate user & get token
// @route   POST /users/login
// @access  Public
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const userId = user._id as mongoose.Types.ObjectId;
    res.json({
      _id: userId,
      username: user.username,
      email: user.email,
      token: generateToken(userId.toString()),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// @desc    Get user profile
// @route   GET /users/profile
// @access  Private
export const getUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = await User.findById(req.user?._id).select("-password");

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
