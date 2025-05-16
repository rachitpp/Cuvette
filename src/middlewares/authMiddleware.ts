import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";

// Add user property to Express Request
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

interface JwtPayload {
  id: string;
}

// Retrieve JWT secret (with fallback in dev)
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("JWT_SECRET not set in production");
      throw new Error("Server configuration error");
    }
    console.warn("JWT_SECRET missing, using insecure fallback for development");
    return "dev_secret_" + Math.random().toString(36).substring(2);
  }
  return secret;
};

// Protect routes using JWT
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      res.status(401).json({ message: "Not authorized, user not found" });
      return;
    }
    req.user = user;
    next();
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: "Token expired, please login again" });
    } else if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: "Invalid token" });
    } else {
      res.status(401).json({ message: "Authentication failed" });
    }
  }
};

// Generate a new JWT for a user
export const generateToken = (id: string): string =>
  jwt.sign({ id }, getJwtSecret(), { expiresIn: "30d" });
