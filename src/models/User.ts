import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcrypt";

export enum UserRole {
  USER = "user",
  MANAGER = "manager",
  ADMIN = "admin",
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username too long"],
      validate: {
        validator: (v: string) => /^[a-zA-Z0-9_-]+$/.test(v),
        message: (props) =>
          `${props.value} is not a valid username. Use only letters, numbers, underscores, or hyphens.`,
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
      immutable: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      validate: {
        validator: (v: string) =>
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(v),
        message:
          "Password must have at least one uppercase, one lowercase, and one number",
      },
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: "Invalid role. Must be one of: user, manager, admin",
      },
      default: UserRole.USER,
      set: (role: string) => role.toLowerCase(),
    },
  },
  {
    timestamps: true,
    validateBeforeSave: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret.password;
        return ret;
      },
    },
  }
);

// Hash password if changed
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare hashed password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error("Password comparison error:", error);
    return false;
  }
};

// Friendly message for duplicate fields
userSchema.post("save", function (error: any, doc: any, next: any) {
  if (error.name === "MongoServerError" && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    next(new Error(`${field} '${value}' is already in use`));
  } else {
    next(error);
  }
});

export default mongoose.model<IUser>("User", userSchema);
