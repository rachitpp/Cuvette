import mongoose from "mongoose";
import { cronJob } from "../jobs/taskCron";

// Database connection function
export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/task-management";
    await mongoose.connect(mongoURI);
    console.log("MongoDB connected...");

    // Start cron job
    cronJob.start();
  } catch (error) {
    console.error("Database connection error:", error);
    process.exit(1);
  }
};
