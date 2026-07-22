import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  image: z.string().url().optional().nullable(),
});

export const organizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const projectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  organizationId: z.string().min(1),
});

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  dueDate: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  projectId: z.string().min(1),
});

export const updateTaskStatusSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]),
  position: z.number().optional(),
});

export const commentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty"),
  taskId: z.string().min(1),
});

export const searchSchema = z.object({
  query: z.string().min(1),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assigneeId: z.string().optional(),
  organizationId: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OrganizationInput = z.infer<typeof organizationSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type CommentInput = z.infer<typeof commentSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
