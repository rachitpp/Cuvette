export enum Permission {
  // User permissions
  READ_PROFILE = "read:profile",
  UPDATE_PROFILE = "update:profile",
  DELETE_PROFILE = "delete:profile",

  // Task permissions
  CREATE_TASK = "create:task",
  READ_TASK = "read:task",
  UPDATE_TASK = "update:task",
  DELETE_TASK = "delete:task",
  ASSIGN_TASK = "assign:task",

  // Admin permissions
  READ_ALL_USERS = "read:all_users",
  UPDATE_USER_ROLES = "update:user_roles",
  DELETE_USER = "delete:user",
  VIEW_METRICS = "view:metrics",

  // Manager permissions
  VIEW_TEAM_METRICS = "view:team_metrics",
  MANAGE_TEAM_TASKS = "manage:team_tasks",
}

export const RolePermissions = {
  user: [
    Permission.READ_PROFILE,
    Permission.UPDATE_PROFILE,
    Permission.CREATE_TASK,
    Permission.READ_TASK,
    Permission.UPDATE_TASK,
    Permission.DELETE_TASK,
  ],

  manager: [
    Permission.READ_PROFILE,
    Permission.UPDATE_PROFILE,
    Permission.CREATE_TASK,
    Permission.READ_TASK,
    Permission.UPDATE_TASK,
    Permission.DELETE_TASK,
    Permission.ASSIGN_TASK,
    Permission.VIEW_TEAM_METRICS,
    Permission.MANAGE_TEAM_TASKS,
  ],

  admin: [
    Permission.READ_PROFILE,
    Permission.UPDATE_PROFILE,
    Permission.CREATE_TASK,
    Permission.READ_TASK,
    Permission.UPDATE_TASK,
    Permission.DELETE_TASK,
    Permission.ASSIGN_TASK,
    Permission.READ_ALL_USERS,
    Permission.UPDATE_USER_ROLES,
    Permission.DELETE_USER,
    Permission.VIEW_METRICS,
    Permission.VIEW_TEAM_METRICS,
    Permission.MANAGE_TEAM_TASKS,
  ],
} as const;
