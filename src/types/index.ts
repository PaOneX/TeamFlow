import type {
  Role,
  TaskStatus,
  TaskPriority,
  ProjectStatus,
  PlanType,
  NotificationType,
} from "@prisma/client";

export type { Role, TaskStatus, TaskPriority, ProjectStatus, PlanType, NotificationType };

export const PLAN_LIMITS = {
  FREE: { organizations: 1, members: 5, projects: 3 },
  PRO: { organizations: 10, members: Infinity, projects: Infinity },
  ENTERPRISE: { organizations: Infinity, members: Infinity, projects: Infinity },
} as const;

export const TASK_STATUSES: TaskStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
];

export const TASK_PRIORITIES: TaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface DashboardMetrics {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  tasksByStatus: { status: string; count: number }[];
  tasksByPriority: { priority: string; count: number }[];
  weeklyActivity: { date: string; count: number }[];
}

export interface SearchResults {
  projects: { id: string; name: string; description: string | null }[];
  tasks: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    projectId: string;
  }[];
  users: { id: string; name: string | null; email: string; image: string | null }[];
  comments: { id: string; content: string; taskId: string }[];
}
