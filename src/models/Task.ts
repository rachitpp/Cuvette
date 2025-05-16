import mongoose, { Document, Schema } from "mongoose";

// Task status enum
export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in-progress",
  DONE = "done",
}

// Task interface
export interface ITask extends Document {
  title: string;
  description: string;
  status: TaskStatus;
  userId: mongoose.Schema.Types.ObjectId;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
}

// Task schema
const taskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters long"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.PENDING,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    completedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Add index for userId to optimize getting tasks for a specific user
taskSchema.index({ userId: 1 });

// Add compound index for title and userId to enforce unique titles per user
taskSchema.index({ title: 1, userId: 1 }, { unique: true });

// Middleware to set completedAt when status is changed to DONE
taskSchema.pre("save", function (next) {
  if (
    this.isModified("status") &&
    this.status === TaskStatus.DONE &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }

  if (
    this.isModified("status") &&
    this.status === TaskStatus.IN_PROGRESS &&
    !this.startedAt
  ) {
    this.startedAt = new Date();
  }

  next();
});

// Create and export Task model
export default mongoose.model<ITask>("Task", taskSchema);
