import cron from "node-cron";
import Task, { TaskStatus } from "../models/Task";

// Function to auto-close tasks that are in-progress for more than 2 hours
const autoCloseTasks = async () => {
  try {
    console.log("Running auto-close tasks job...");

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Find tasks that are in-progress and were started more than 2 hours ago
    const tasksToClose = await Task.find({
      status: TaskStatus.IN_PROGRESS,
      startedAt: { $lt: twoHoursAgo },
    });

    if (tasksToClose.length === 0) {
      console.log("No tasks to auto-close");
      return;
    }

    console.log(`Found ${tasksToClose.length} tasks to auto-close`);

    // Update tasks to DONE and set completedAt
    const updatePromises = tasksToClose.map(async (task) => {
      task.status = TaskStatus.DONE;
      task.completedAt = new Date();
      return task.save();
    });

    await Promise.all(updatePromises);

    console.log(`Successfully auto-closed ${tasksToClose.length} tasks`);
  } catch (error) {
    console.error("Error in auto-close tasks job:", error);
  }
};

// Schedule cron job to run every 15 minutes
// '*/15 * * * *' means "every 15 minutes"
export const cronJob = cron.schedule("*/15 * * * *", autoCloseTasks);

// Stop the job initially - we'll start it when the app starts
cronJob.stop();

// For testing purposes
export const runAutoCloseTasksJob = autoCloseTasks;
