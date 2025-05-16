import mongoose, { Document, Schema } from "mongoose";

// Task statuses
export enum TaskStatus {
  PENDING = "pending",
  IN_PROGRESS = "in-progress",
  DONE = "done",
}

// Task priority levels
export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

// Structure for task comments
export interface IComment {
  userId: mongoose.Schema.Types.ObjectId;
  text: string;
  createdAt: Date;
}

// Embedded comments schema
const commentSchema = new Schema<IComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, "Comment too long"],
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

export interface ITask extends Document {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  userId: mongoose.Schema.Types.ObjectId;
  collaborators: mongoose.Schema.Types.ObjectId[];
  tags: string[];
  category: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  dueDate?: Date;
  estimatedTime?: number;
  comments: IComment[];
}

const taskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [100, "Title too long"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [1000, "Description too long"],
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.PENDING,
    },
    priority: {
      type: String,
      enum: Object.values(TaskPriority),
      default: TaskPriority.MEDIUM,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      validate: {
        validator: async function (id: mongoose.Types.ObjectId) {
          const exists = await mongoose.model("User").exists({ _id: id });
          return !!exists;
        },
        message: "User not found",
      },
    },
    collaborators: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
      validate: {
        validator: async function (ids: mongoose.Types.ObjectId[]) {
          if (!ids.length) return true;
          const count = await mongoose
            .model("User")
            .countDocuments({ _id: { $in: ids } });
          return count === ids.length;
        },
        message: "Some collaborators do not exist",
      },
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.every((tag) => tag.length <= 20),
        message: "Tags max 20 chars",
      },
    },
    category: {
      type: String,
      trim: true,
      maxlength: [30, "Category too long"],
      default: "Uncategorized",
    },
    completedAt: {
      type: Date,
      default: null,
      validate: {
        validator: (d: Date) => !d || d <= new Date(),
        message: "Completed date can't be future",
      },
    },
    startedAt: { type: Date, default: null },
    dueDate: {
      type: Date,
      default: null,
      set: function (val: string | Date) {
        if (typeof val === "string" && val) {
          // Handle multiple date formats

          // Handle DD-MM-YYYY format (e.g., 15-12-2023)
          const ddmmyyyyPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
          if (ddmmyyyyPattern.test(val)) {
            const [_, day, month, year] = ddmmyyyyPattern.exec(val) || [];
            const d = parseInt(day);
            const m = parseInt(month) - 1; // JS months are 0-indexed
            const y = parseInt(year);

            if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
              const date = new Date(y, m, d);
              // Validate if date is valid
              if (
                date.getFullYear() === y &&
                date.getMonth() === m &&
                date.getDate() === d
              ) {
                return date;
              }
            }
          }

          // Try standard date parsing for ISO formats (e.g., 2023-12-15)
          const isoDate = new Date(val);
          if (!isNaN(isoDate.getTime())) {
            return isoDate;
          }

          // If none of the conversions work, log a warning
          console.warn(`Invalid date format: ${val}. Use format DD-MM-YYYY`);
        }
        return val;
      },
      validate: {
        validator: function (d: Date) {
          return !this.isNew || !d || d > new Date();
        },
        message: "Due date must be in future",
      },
    },
    estimatedTime: {
      type: Number,
      min: [1, "At least 1 min"],
      max: [10080, "Max 10080 min"],
      default: null,
    },
    comments: { type: [commentSchema], default: [] },
  },
  { timestamps: true, validateBeforeSave: true }
);

// Indexes and hooks unchanged

taskSchema.index({ userId: 1 });
taskSchema.index(
  { title: 1, userId: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
taskSchema.index({ status: 1, priority: -1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ tags: 1 });
taskSchema.index({ category: 1 });
taskSchema.index({ collaborators: 1 });

taskSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === TaskStatus.DONE && !this.completedAt) {
      this.completedAt = new Date();
    }
    if (this.status === TaskStatus.IN_PROGRESS && !this.startedAt) {
      this.startedAt = new Date();
    }
    if (this.status !== TaskStatus.DONE && this.completedAt) {
      this.completedAt = undefined;
    }
  }
  next();
});

taskSchema.post("save", function (err: any, _: any, next: any) {
  if (err.name === "MongoServerError" && err.code === 11000) {
    next(new Error("Task with this title already exists for this user"));
  } else {
    next(err);
  }
});

taskSchema.statics.findOverdueTasks = async function () {
  return this.find({
    dueDate: { $lt: new Date() },
    status: { $ne: TaskStatus.DONE },
  }).sort({ dueDate: 1 });
};

export default mongoose.model<ITask>("Task", taskSchema);
