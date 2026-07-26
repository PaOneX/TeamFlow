"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sendMentionEmail } from "@/lib/email";
import { triggerEvent } from "@/lib/pusher";
import { requireAuth, requireMembership } from "@/lib/session";
import { commentSchema } from "@/schemas";
import { extractMentions } from "@/utils/helpers";
import type { ActionResult } from "@/types";

async function getCommentContext(taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, organizationId: true } },
    },
  });
  return task;
}

async function resolveMentionedUsers(
  mentions: string[],
  organizationId: string
) {
  if (mentions.length === 0) return [];

  const members = await db.membership.findMany({
    where: { organizationId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return members
    .map((m) => m.user)
    .filter((user) =>
      mentions.some((mention) => {
        const normalized = mention.toLowerCase();
        const nameMatch = user.name?.toLowerCase().replace(/\s+/g, "") === normalized;
        const emailPrefix = user.email.split("@")[0].toLowerCase();
        return nameMatch || emailPrefix === normalized;
      })
    );
}

export async function createComment(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAuth();
    const parsed = commentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const task = await getCommentContext(parsed.data.taskId);
    if (!task) {
      return { success: false, error: "Task not found" };
    }

    await requireMembership(task.project.organizationId, session.user.id);

    const mentions = extractMentions(parsed.data.content);

    const comment = await db.comment.create({
      data: {
        content: parsed.data.content,
        taskId: parsed.data.taskId,
        authorId: session.user.id,
        mentions,
      },
      include: {
        author: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    const mentionedUsers = await resolveMentionedUsers(
      mentions,
      task.project.organizationId
    );

    const author = await db.user.findUnique({
      where: { id: session.user.id },
    });

    for (const user of mentionedUsers) {
      if (user.id === session.user.id) continue;

      await db.notification.create({
        data: {
          type: "MENTION",
          title: "You were mentioned",
          message: `${author?.name ?? "Someone"} mentioned you on "${task.title}"`,
          userId: user.id,
          organizationId: task.project.organizationId,
          link: `/tasks/${task.id}`,
        },
      });

      await sendMentionEmail(
        user.email,
        author?.name ?? "A team member",
        task.title,
        task.id
      );
    }

    await triggerEvent(`project-${task.projectId}`, "comment-added", {
      comment,
      taskId: task.id,
    });

    revalidatePath(`/tasks/${task.id}`);

    return { success: true, data: { id: comment.id } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create comment",
    };
  }
}

export async function updateComment(
  id: string,
  content: string
): Promise<ActionResult> {
  try {
    const session = await requireAuth();

    const comment = await db.comment.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            project: { select: { organizationId: true } },
          },
        },
      },
    });

    if (!comment) {
      return { success: false, error: "Comment not found" };
    }

    if (comment.authorId !== session.user.id) {
      return { success: false, error: "Not authorized to edit this comment" };
    }

    await requireMembership(
      comment.task.project.organizationId,
      session.user.id
    );

    const mentions = extractMentions(content);

    await db.comment.update({
      where: { id },
      data: { content, mentions },
    });

    revalidatePath(`/tasks/${comment.taskId}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update comment",
    };
  }
}

export async function deleteComment(id: string): Promise<ActionResult> {
  try {
    const session = await requireAuth();

    const comment = await db.comment.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            project: { select: { organizationId: true } },
          },
        },
      },
    });

    if (!comment) {
      return { success: false, error: "Comment not found" };
    }

    const membership = await requireMembership(
      comment.task.project.organizationId,
      session.user.id
    );

    if (
      comment.authorId !== session.user.id &&
      !["OWNER", "ADMIN"].includes(membership.role)
    ) {
      return { success: false, error: "Not authorized to delete this comment" };
    }

    await db.comment.delete({ where: { id } });

    revalidatePath(`/tasks/${comment.taskId}`);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete comment",
    };
  }
}
