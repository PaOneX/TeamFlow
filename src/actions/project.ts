"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireMembership } from "@/lib/session";
import { checkPlanLimits } from "@/services/organization";
import { projectSchema } from "@/schemas";
import type { ActionResult } from "@/types";

async function getProjectOrgId(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true, id: true },
  });
  return project;
}

export async function createProject(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAuth();
    const parsed = projectSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    await requireMembership(parsed.data.organizationId, session.user.id);

    const limits = await checkPlanLimits(parsed.data.organizationId, "projects");
    if (!limits.allowed) {
      return {
        success: false,
        error: "Project limit reached for your plan",
      };
    }

    const project = await db.project.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        organizationId: parsed.data.organizationId,
      },
    });

    await db.projectMember.create({
      data: {
        projectId: project.id,
        userId: session.user.id,
      },
    });

    await db.activityLog.create({
      data: {
        action: "created",
        entityType: "project",
        entityId: project.id,
        metadata: { name: project.name },
        userId: session.user.id,
        organizationId: parsed.data.organizationId,
        projectId: project.id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/projects");

    return { success: true, data: { id: project.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create project",
    };
  }
}

export async function updateProject(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const project = await getProjectOrgId(id);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    await requireMembership(project.organizationId, session.user.id);

    const parsed = projectSchema.safeParse({
      ...Object.fromEntries(formData),
      organizationId: project.organizationId,
    });
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const updated = await db.project.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      },
    });

    await db.activityLog.create({
      data: {
        action: "updated",
        entityType: "project",
        entityId: id,
        metadata: { name: updated.name },
        userId: session.user.id,
        organizationId: project.organizationId,
        projectId: id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/projects/${id}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update project",
    };
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    await requireMembership(project.organizationId, session.user.id, [
      "OWNER",
      "ADMIN",
    ]);

    await db.activityLog.create({
      data: {
        action: "deleted",
        entityType: "project",
        entityId: id,
        metadata: { name: project.name },
        userId: session.user.id,
        organizationId: project.organizationId,
        projectId: id,
      },
    });

    await db.project.delete({ where: { id } });

    revalidatePath("/dashboard");
    revalidatePath("/projects");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete project",
    };
  }
}

export async function archiveProject(id: string): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const project = await getProjectOrgId(id);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    await requireMembership(project.organizationId, session.user.id);

    const updated = await db.project.update({
      where: { id },
      data: { status: "ARCHIVED" },
    });

    await db.activityLog.create({
      data: {
        action: "updated",
        entityType: "project",
        entityId: id,
        metadata: { name: updated.name, status: "ARCHIVED" },
        userId: session.user.id,
        organizationId: project.organizationId,
        projectId: id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/projects/${id}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to archive project",
    };
  }
}

export async function addProjectMember(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const project = await getProjectOrgId(projectId);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    await requireMembership(project.organizationId, session.user.id);

    const member = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId,
        },
      },
    });

    if (!member) {
      return { success: false, error: "User is not a member of this organization" };
    }

    await db.projectMember.upsert({
      where: {
        projectId_userId: { projectId, userId },
      },
      create: { projectId, userId },
      update: {},
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add project member",
    };
  }
}

export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const project = await getProjectOrgId(projectId);
    if (!project) {
      return { success: false, error: "Project not found" };
    }

    await requireMembership(project.organizationId, session.user.id);

    await db.projectMember.delete({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove project member",
    };
  }
}
