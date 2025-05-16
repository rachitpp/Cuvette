import cron from "node-cron";
import Task, { TaskStatus } from "../models/Task";

// Auto-close tasks stuck in progress for over 2 hours
const autoCloseTasks = async () => {
  try {
    console.log("Auto-close job running...");

    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const tasks = await Task.find({
      status: TaskStatus.IN_PROGRESS,
      startedAt: { $lt: new Date(cutoff) },
    });

    if (!tasks.length) {
      console.log("No tasks to close");
      return;
    }

    console.log(`Closing ${tasks.length} tasks`);

    await Promise.all(
      tasks.map((task) => {
        task.status = TaskStatus.DONE;
        task.completedAt = new Date();
        return task.save();
      })
    );

    console.log("Auto-close complete");
  } catch (err) {
    console.error("Auto-close failed:", err);
  }
};

// Schedule every 15 minutes
export const cronJob = cron.schedule("*/15 * * * *", autoCloseTasks);

// Hold off until DB is ready
cronJob.stop();

// For manual triggering or tests
export const runAutoCloseTasksJob = autoCloseTasks;
