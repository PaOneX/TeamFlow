"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendInvitationEmail } from "@/lib/email";
import { requireAuth, requireMembership } from "@/lib/session";
import { checkPlanLimits } from "@/services/organization";
import { organizationSchema, inviteMemberSchema } from "@/schemas";
import { slugify } from "@/utils/helpers";
import { PLAN_LIMITS } from "@/types";
import type { ActionResult } from "@/types";
import type { Role } from "@prisma/client";

async function generateUniqueSlug(name: string) {
  let slug = slugify(name);
  const existing = await db.organization.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${nanoid(6)}`;
  }
  return slug;
}

export async function createOrganization(
  formData: FormData
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await requireAuth();
    const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const ownedCount = await db.organization.count({
      where: { ownerId: session.user.id },
    });

    if (ownedCount >= PLAN_LIMITS.FREE.organizations) {
      return {
        success: false,
        error: "Organization limit reached for your plan",
      };
    }

    const slug = await generateUniqueSlug(parsed.data.name);

    const organization = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          ownerId: session.user.id,
        },
      });

      await tx.membership.create({
        data: {
          organizationId: org.id,
          userId: session.user.id,
          role: "OWNER",
        },
      });

      await tx.subscription.create({
        data: {
          organizationId: org.id,
          plan: "FREE",
        },
      });

      await tx.activityLog.create({
        data: {
          action: "created",
          entityType: "organization",
          entityId: org.id,
          metadata: { name: org.name },
          userId: session.user.id,
          organizationId: org.id,
        },
      });

      return org;
    });

    revalidatePath("/dashboard");
    revalidatePath("/organizations");

    return {
      success: true,
      data: { id: organization.id, slug: organization.slug },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create organization",
    };
  }
}

export async function updateOrganization(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await requireMembership(id, session.user.id, ["OWNER", "ADMIN"]);

    const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const organization = await db.organization.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
      },
    });

    await db.activityLog.create({
      data: {
        action: "updated",
        entityType: "organization",
        entityId: id,
        metadata: { name: organization.name },
        userId: session.user.id,
        organizationId: id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/organizations/${organization.slug}`);
    revalidatePath("/settings/organization");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update organization",
    };
  }
}

export async function deleteOrganization(id: string): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await requireMembership(id, session.user.id, ["OWNER"]);

    const organization = await db.organization.findUnique({ where: { id } });
    if (!organization) {
      return { success: false, error: "Organization not found" };
    }

    await db.activityLog.create({
      data: {
        action: "deleted",
        entityType: "organization",
        entityId: id,
        metadata: { name: organization.name },
        userId: session.user.id,
        organizationId: id,
      },
    });

    await db.organization.delete({ where: { id } });

    revalidatePath("/dashboard");
    revalidatePath("/organizations");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete organization",
    };
  }
}

export async function inviteMember(
  orgId: string,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await requireMembership(orgId, session.user.id, ["OWNER", "ADMIN"]);

    const parsed = inviteMemberSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const limits = await checkPlanLimits(orgId, "members");
    if (!limits.allowed) {
      return {
        success: false,
        error: "Member limit reached for your plan",
      };
    }

    const existingMember = await db.membership.findFirst({
      where: {
        organizationId: orgId,
        user: { email: parsed.data.email },
      },
    });

    if (existingMember) {
      return { success: false, error: "User is already a member" };
    }

    const existingInvite = await db.invitation.findUnique({
      where: {
        organizationId_email: {
          organizationId: orgId,
          email: parsed.data.email,
        },
      },
    });

    if (existingInvite && !existingInvite.acceptedAt) {
      return { success: false, error: "Invitation already sent" };
    }

    const organization = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return { success: false, error: "Organization not found" };
    }

    const invitation = await db.invitation.create({
      data: {
        email: parsed.data.email,
        role: parsed.data.role as Role,
        organizationId: orgId,
        invitedById: session.user.id,
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const inviter = await db.user.findUnique({
      where: { id: session.user.id },
    });

    await sendInvitationEmail(
      parsed.data.email,
      organization.name,
      invitation.token,
      inviter?.name ?? "A team member"
    );

    revalidatePath(`/organizations/${organization.slug}/members`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invitation",
    };
  }
}

export async function removeMember(
  orgId: string,
  userId: string
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await requireMembership(orgId, session.user.id, ["OWNER", "ADMIN"]);

    const organization = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (organization?.ownerId === userId) {
      return { success: false, error: "Cannot remove the organization owner" };
    }

    await db.membership.delete({
      where: {
        organizationId_userId: { organizationId: orgId, userId },
      },
    });

    revalidatePath("/dashboard");
    if (organization) {
      revalidatePath(`/organizations/${organization.slug}/members`);
    }

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove member",
    };
  }
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: Role
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await requireMembership(orgId, session.user.id, ["OWNER"]);

    const organization = await db.organization.findUnique({
      where: { id: orgId },
    });

    if (organization?.ownerId === userId && role !== "OWNER") {
      return { success: false, error: "Cannot change the owner's role" };
    }

    await db.membership.update({
      where: {
        organizationId_userId: { organizationId: orgId, userId },
      },
      data: { role },
    });

    revalidatePath("/dashboard");
    if (organization) {
      revalidatePath(`/organizations/${organization.slug}/members`);
    }

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update role",
    };
  }
}

export async function acceptInvitation(
  token: string
): Promise<ActionResult<{ organizationId: string }>> {
  try {
    const session = await requireAuth();

    const invitation = await db.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation || invitation.acceptedAt) {
      return { success: false, error: "Invalid invitation" };
    }

    if (invitation.expires < new Date()) {
      return { success: false, error: "Invitation has expired" };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (user?.email !== invitation.email) {
      return {
        success: false,
        error: "This invitation was sent to a different email address",
      };
    }

    const existing = await db.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
        },
      },
    });

    if (existing) {
      return { success: false, error: "You are already a member" };
    }

    await db.$transaction([
      db.membership.create({
        data: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
          role: invitation.role,
        },
      }),
      db.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
      db.notification.create({
        data: {
          type: "INVITATION",
          title: "Welcome to the team",
          message: `You joined ${invitation.organization.name}`,
          userId: session.user.id,
          organizationId: invitation.organizationId,
          link: `/organizations/${invitation.organization.slug}`,
        },
      }),
    ]);

    revalidatePath("/dashboard");
    revalidatePath("/organizations");

    return {
      success: true,
      data: { organizationId: invitation.organizationId },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to accept invitation",
    };
  }
}
