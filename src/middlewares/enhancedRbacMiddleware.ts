import { Request, Response, NextFunction } from "express";
import { Permission, RolePermissions } from "../types/permissions";
import { UserRole } from "../models/User";

// Check if a role has a specific permission
const hasPermission = (role: UserRole, permission: Permission): boolean => {
  const rolePermissions =
    RolePermissions[role.toLowerCase() as keyof typeof RolePermissions];
  return rolePermissions.includes(permission as any);
};

// Middleware to check for specific permissions
export const requirePermission = (permission: Permission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({
        message: `Access forbidden: missing permission '${permission}'`,
      });
      return;
    }

    next();
  };
};

// Middleware to check for multiple permissions (must have all)
export const requirePermissions = (permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const missingPermissions = permissions.filter(
      (permission) => !hasPermission(req.user!.role, permission)
    );

    if (missingPermissions.length > 0) {
      res.status(403).json({
        message: "Access forbidden: missing required permissions",
        missingPermissions,
      });
      return;
    }

    next();
  };
};

// Middleware to check for any of the permissions (must have at least one)
export const requireAnyPermission = (permissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const hasAnyPermission = permissions.some((permission) =>
      hasPermission(req.user!.role, permission)
    );

    if (!hasAnyPermission) {
      res.status(403).json({
        message: "Access forbidden: missing at least one required permission",
        requiredPermissions: permissions,
      });
      return;
    }

    next();
  };
};

// Audit logging middleware for sensitive operations
export const auditLog = (operation: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    console.log(
      `[AUDIT] ${new Date().toISOString()} - User ${user?._id} (${
        user?.role
      }) performed ${operation}`
    );
    next();
  };
};
