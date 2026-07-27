"use server";

import { db } from "@/lib/db";
import { requireAuth, requireMembership } from "@/lib/session";
import { searchSchema } from "@/schemas";
import type { ActionResult, SearchResults } from "@/types";
import type { TaskPriority, TaskStatus } from "@prisma/client";

export async function search(
  input: unknown
): Promise<ActionResult<SearchResults>> {
  try {
    const session = await requireAuth();
    const parsed = searchSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const { query, status, priority, assigneeId, organizationId } = parsed.data;

    if (organizationId) {
      await requireMembership(organizationId, session.user.id);
    }

    const userMemberships = await db.membership.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });

    const orgIds = organizationId
      ? [organizationId]
      : userMemberships.map((m) => m.organizationId);

    const projectFilter = { organizationId: { in: orgIds } };

    const taskWhere: {
      project: { organizationId: { in: string[] } };
      title?: { contains: string; mode: "insensitive" };
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string;
    } = {
      project: projectFilter,
      title: { contains: query, mode: "insensitive" },
    };

    if (status) taskWhere.status = status;
    if (priority) taskWhere.priority = priority;
    if (assigneeId) taskWhere.assigneeId = assigneeId;

    const [projects, tasks, users, comments] = await Promise.all([
      db.project.findMany({
        where: {
          ...projectFilter,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, description: true },
        take: 10,
      }),
      db.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          projectId: true,
        },
        take: 10,
      }),
      db.membership.findMany({
        where: {
          organizationId: { in: orgIds },
          user: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        },
        select: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
        take: 10,
      }),
      db.comment.findMany({
        where: {
          content: { contains: query, mode: "insensitive" },
          task: { project: projectFilter },
        },
        select: { id: true, content: true, taskId: true },
        take: 10,
      }),
    ]);

    return {
      success: true,
      data: {
        projects,
        tasks,
        users: users.map((m) => m.user),
        comments,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}
