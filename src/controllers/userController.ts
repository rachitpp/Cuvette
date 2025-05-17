import { Request, Response } from "express";
import { validationResult } from "express-validator";
import mongoose from "mongoose";
import User, { IUser, UserRole } from "../models/User";
import { generateToken } from "../middlewares/authMiddleware";
import { withRetry, withTransaction, formatDbError } from "../utils/dbHelpers";

// Handle new user registration
export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { username, email, password, role } = req.body;

    try {
      const user = await withTransaction(async (session) => {
        const existingEmail = await User.findOne({ email }).session(session);
        if (existingEmail) {
          throw new Error("User with this email already exists");
        }

        const existingUsername = await User.findOne({ username }).session(
          session
        );
        if (existingUsername) {
          throw new Error("User with this username already exists");
        }

        // Create user with role if provided
        const userData = {
          username,
          email,
          password,
          role: role || UserRole.USER, // Default to USER if no role provided
        };

        const newUser = await User.create([userData], {
          session,
        });

        return newUser[0];
      });

      const userId = user._id as mongoose.Types.ObjectId;
      res.status(201).json({
        _id: userId,
        username: user.username,
        email: user.email,
        role: user.role,
        token: generateToken(userId.toString()),
      });
    } catch (error: any) {
      if (error.message.includes("already exists")) {
        res.status(409).json({ message: error.message });
      } else if (error.name === "ValidationError") {
        res.status(400).json({ message: formatDbError(error) });
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    console.error("Error registering user:", error);
    res.status(500).json({
      message: "Could not register user",
      error:
        process.env.NODE_ENV === "production"
          ? undefined
          : formatDbError(error),
    });
  }
};

// Handle user login
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    const user = await withRetry(async () => {
      const user = await User.findOne({ email });
      if (!user) throw new Error("Invalid email or password");

      const isMatch = await user.comparePassword(password);
      if (!isMatch) throw new Error("Invalid email or password");

      return user;
    });

    const userId = user._id as mongoose.Types.ObjectId;
    res.json({
      _id: userId,
      username: user.username,
      email: user.email,
      role: user.role,
      token: generateToken(userId.toString()),
    });
  } catch (error: any) {
    console.error("Error logging in:", error);
    if (error.message.includes("Invalid email or password")) {
      res.status(401).json({ message: "Invalid email or password" });
    } else {
      res.status(500).json({
        message: "Server error",
        error:
          process.env.NODE_ENV === "production"
            ? undefined
            : formatDbError(error),
      });
    }
  }
};

// Fetch current user's profile
export const getUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Not authorized" });
      return;
    }

    const user = await withRetry(async () => {
      const user = await User.findById(userId).select("-password");
      if (!user) throw new Error("User not found");
      return user;
    });

    res.json(user);
  } catch (error: any) {
    console.error("Error getting user profile:", error);
    if (error.message.includes("not found")) {
      res.status(404).json({ message: formatDbError(error) });
    } else {
      res.status(500).json({
        message: "Server error",
        error:
          process.env.NODE_ENV === "production"
            ? undefined
            : formatDbError(error),
      });
    }
  }
};
