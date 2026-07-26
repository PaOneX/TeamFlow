import { db } from "@/lib/db";
import { TASK_STATUSES, TASK_PRIORITIES } from "@/types";
import type { DashboardMetrics } from "@/types";

export async function getDashboardMetrics(
  organizationId: string
): Promise<DashboardMetrics> {
  const projects = await db.project.findMany({
    where: { organizationId },
    select: { id: true },
  });

  const projectIds = projects.map((p) => p.id);

  const [totalProjects, totalTasks, completedTasks, statusCounts, priorityCounts, activities] =
    await Promise.all([
      db.project.count({ where: { organizationId } }),
      db.task.count({ where: { projectId: { in: projectIds } } }),
      db.task.count({
        where: { projectId: { in: projectIds }, status: "DONE" },
      }),
      db.task.groupBy({
        by: ["status"],
        where: { projectId: { in: projectIds } },
        _count: { status: true },
      }),
      db.task.groupBy({
        by: ["priority"],
        where: { projectId: { in: projectIds } },
        _count: { priority: true },
      }),
      db.activityLog.findMany({
        where: {
          organizationId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true },
      }),
    ]);

  const statusMap = new Map(statusCounts.map((s) => [s.status, s._count.status]));
  const priorityMap = new Map(
    priorityCounts.map((p) => [p.priority, p._count.priority])
  );

  const tasksByStatus = TASK_STATUSES.map((status) => ({
    status,
    count: statusMap.get(status) ?? 0,
  }));

  const tasksByPriority = TASK_PRIORITIES.map((priority) => ({
    priority,
    count: priorityMap.get(priority) ?? 0,
  }));

  const weeklyActivity: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = activities.filter(
      (a) => a.createdAt >= date && a.createdAt < nextDate
    ).length;

    weeklyActivity.push({
      date: date.toISOString().split("T")[0],
      count,
    });
  }

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    totalProjects,
    totalTasks,
    completedTasks,
    completionRate,
    tasksByStatus,
    tasksByPriority,
    weeklyActivity,
  };
}
