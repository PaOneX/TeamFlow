import { db } from "@/lib/db";

export async function getProjectsByOrg(orgId: string) {
  return db.project.findMany({
    where: { organizationId: orgId },
    include: {
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProjectById(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      organization: true,
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
      _count: { select: { tasks: true } },
    },
  });
}

export async function getProjectTasks(projectId: string) {
  return db.task.findMany({
    where: { projectId },
    include: {
      assignee: {
        select: { id: true, name: true, email: true, image: true },
      },
      creator: {
        select: { id: true, name: true, email: true, image: true },
      },
      _count: { select: { comments: true, attachments: true } },
    },
    orderBy: [{ status: "asc" }, { position: "asc" }],
  });
}
