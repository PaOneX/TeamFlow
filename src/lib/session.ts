import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.user.findUnique({
    where: { id: session.user.id },
  });
}

export async function getMembership(organizationId: string, userId: string) {
  return db.membership.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });
}

export async function requireMembership(
  organizationId: string,
  userId: string,
  allowedRoles?: Role[]
) {
  const membership = await getMembership(organizationId, userId);
  if (!membership) {
    throw new Error("Not a member of this organization");
  }
  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new Error("Insufficient permissions");
  }
  return membership;
}

export async function getUserOrganizations(userId: string) {
  return db.membership.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          subscription: true,
          _count: { select: { memberships: true, projects: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
