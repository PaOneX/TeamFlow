import { db } from "@/lib/db";
import type { TaskStatus } from "@prisma/client";

export async function getTaskById(id: string) {
  return db.task.findUnique({
    where: { id },
    include: {
      project: {
        select: { id: true, name: true, organizationId: true },
      },
      assignee: {
        select: { id: true, name: true, email: true, image: true },
      },
      creator: {
        select: { id: true, name: true, email: true, image: true },
      },
      comments: {
        include: {
          author: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getTasksByStatus(projectId: string) {
  const tasks = await db.task.findMany({
    where: { projectId },
    include: {
      assignee: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { position: "asc" },
  });

  const grouped: Record<TaskStatus, typeof tasks> = {
    BACKLOG: [],
    TODO: [],
    IN_PROGRESS: [],
    REVIEW: [],
    DONE: [],
  };

  for (const task of tasks) {
    grouped[task.status].push(task);
  }

  return grouped;
}
