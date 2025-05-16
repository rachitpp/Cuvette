import mongoose from "mongoose";
import { cronJob } from "../jobs/taskCron";

const MAX_RETRIES = 5;
const RETRY_INTERVAL = 5000;

export const connectDB = async (retryCount = 0): Promise<void> => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/task-management";

    // Enable strict query mode
    mongoose.set("strictQuery", true);

    const options: mongoose.ConnectOptions = {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      family: 4,
    };

    await mongoose.connect(mongoURI, options);
    console.log("MongoDB connected");

    // Start scheduled tasks
    cronJob.start();

    // Reconnect on errors
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB error:", err);
      if (!mongoose.connection.readyState) {
        console.log("Connection lost, retrying...");
        setTimeout(() => connectDB(0), RETRY_INTERVAL);
      }
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected, retrying...");
      setTimeout(() => connectDB(0), RETRY_INTERVAL);
    });

    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("Connection closed. App terminated.");
      process.exit(0);
    });
  } catch (error) {
    console.error(
      `DB connection failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`,
      error
    );

    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_INTERVAL / 1000}s...`);
      setTimeout(() => {
        connectDB(retryCount + 1);
      }, RETRY_INTERVAL);
    } else {
      console.error("Max retries reached. Exiting.");
      process.exit(1);
    }
  }
};
