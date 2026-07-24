import { db } from "@/lib/db";
import { PLAN_LIMITS } from "@/types";
import type { PlanType } from "@prisma/client";

export async function getOrganizationById(id: string) {
  return db.organization.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, email: true, image: true },
      },
      subscription: true,
      _count: { select: { memberships: true, projects: true } },
    },
  });
}

export async function getOrganizationMembers(id: string) {
  return db.membership.findMany({
    where: { organizationId: id },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function checkPlanLimits(
  orgId: string,
  type: "members" | "projects" | "organizations"
) {
  const organization = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      subscription: true,
      _count: { select: { memberships: true, projects: true } },
    },
  });

  if (!organization) {
    return { allowed: false, current: 0, limit: 0 };
  }

  const plan: PlanType = organization.subscription?.plan ?? "FREE";
  const limits = PLAN_LIMITS[plan];

  if (type === "members") {
    const current = organization._count.memberships;
    return {
      allowed: current < limits.members,
      current,
      limit: limits.members,
    };
  }

  if (type === "projects") {
    const current = organization._count.projects;
    return {
      allowed: current < limits.projects,
      current,
      limit: limits.projects,
    };
  }

  const ownedCount = await db.organization.count({
    where: { ownerId: organization.ownerId },
  });

  return {
    allowed: ownedCount < limits.organizations,
    current: ownedCount,
    limit: limits.organizations,
  };
}
