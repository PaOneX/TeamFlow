"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { triggerEvent } from "@/lib/pusher";
import { requireAuth, requireMembership } from "@/lib/session";
import { taskSchema, updateTaskStatusSchema } from "@/schemas";
import type { ActionResult } from "@/types";

async function getTaskContext(taskId: string) {
  return db.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, organizationId: true } },
    },
  });
}

export async function createTask(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAuth();
    const parsed = taskSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const project = await db.project.findUnique({
      where: { id: parsed.data.projectId },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    await requireMembership(project.organizationId, session.user.id);

    const maxPosition = await db.task.aggregate({
      where: {
        projectId: parsed.data.projectId,
        status: parsed.data.status ?? "TODO",
      },
      _max: { position: true },
    });

    const task = await db.task.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status ?? "TODO",
        priority: parsed.data.priority ?? "MEDIUM",
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        assigneeId: parsed.data.assigneeId || null,
        projectId: parsed.data.projectId,
        creatorId: session.user.id,
        position: (maxPosition._max.position ?? -1) + 1,
      },
    });

    await db.activityLog.create({
      data: {
        action: "created",
        entityType: "task",
        entityId: task.id,
        metadata: { title: task.title },
        userId: session.user.id,
        organizationId: project.organizationId,
        projectId: project.id,
        taskId: task.id,
      },
    });

    if (task.assigneeId && task.assigneeId !== session.user.id) {
      await db.notification.create({
        data: {
          type: "TASK_ASSIGNED",
          title: "Task assigned",
          message: `You were assigned to "${task.title}"`,
          userId: task.assigneeId,
          organizationId: project.organizationId,
          link: `/tasks/${task.id}`,
        },
      });
    }

    revalidatePath(`/projects/${project.id}`);
    revalidatePath("/dashboard");

    return { success: true, data: { id: task.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create task",
    };
  }
}

export async function updateTask(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const task = await getTaskContext(id);
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    await requireMembership(task.project.organizationId, session.user.id);

    const parsed = taskSchema.safeParse({
      ...Object.fromEntries(formData),
      projectId: task.projectId,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const updated = await db.task.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        priority: parsed.data.priority,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        assigneeId: parsed.data.assigneeId || null,
      },
    });

    await db.activityLog.create({
      data: {
        action: "updated",
        entityType: "task",
        entityId: id,
        metadata: { title: updated.title },
        userId: session.user.id,
        organizationId: task.project.organizationId,
        projectId: task.projectId,
        taskId: id,
      },
    });

    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath(`/tasks/${id}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update task",
    };
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const task = await db.task.findUnique({ where: { id } });
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    const project = await db.project.findUnique({
      where: { id: task.projectId },
    });

    if (!project) {
      return { success: false, error: "Project not found" };
    }

    await requireMembership(project.organizationId, session.user.id);

    await db.activityLog.create({
      data: {
        action: "deleted",
        entityType: "task",
        entityId: id,
        metadata: { title: task.title },
        userId: session.user.id,
        organizationId: project.organizationId,
        projectId: task.projectId,
        taskId: id,
      },
    });

    await db.task.delete({ where: { id } });

    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath("/dashboard");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete task",
    };
  }
}

export async function updateTaskStatus(input: {
  taskId: string;
  status: string;
  position?: number;
}): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const parsed = updateTaskStatusSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const task = await getTaskContext(parsed.data.taskId);
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    await requireMembership(task.project.organizationId, session.user.id);

    const updated = await db.task.update({
      where: { id: parsed.data.taskId },
      data: {
        status: parsed.data.status,
        position: parsed.data.position ?? task.position,
      },
    });

    await db.activityLog.create({
      data: {
        action: "updated",
        entityType: "task",
        entityId: task.id,
        metadata: { title: updated.title, status: updated.status },
        userId: session.user.id,
        organizationId: task.project.organizationId,
        projectId: task.projectId,
        taskId: task.id,
      },
    });

    await triggerEvent(`project-${task.projectId}`, "task-updated", {
      taskId: updated.id,
      status: updated.status,
      position: updated.position,
    });

    revalidatePath(`/projects/${task.projectId}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update task status",
    };
  }
}

export async function assignTask(
  taskId: string,
  assigneeId: string | null
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const task = await getTaskContext(taskId);
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    await requireMembership(task.project.organizationId, session.user.id);

    const updated = await db.task.update({
      where: { id: taskId },
      data: { assigneeId },
    });

    if (assigneeId && assigneeId !== session.user.id) {
      await db.notification.create({
        data: {
          type: "TASK_ASSIGNED",
          title: "Task assigned",
          message: `You were assigned to "${updated.title}"`,
          userId: assigneeId,
          organizationId: task.project.organizationId,
          link: `/tasks/${taskId}`,
        },
      });
    }

    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath(`/tasks/${taskId}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to assign task",
    };
  }
}
