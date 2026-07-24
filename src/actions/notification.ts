"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import type { ActionResult } from "@/types";

export async function markAsRead(id: string): Promise<ActionResult> {
  try {
    const session = await requireAuth();

    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== session.user.id) {
      return { success: false, error: "Notification not found" };
    }

    await db.notification.update({
      where: { id },
      data: { read: true },
    });

    revalidatePath("/dashboard");
    revalidatePath("/notifications");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark as read",
    };
  }
}

export async function markAllAsRead(): Promise<ActionResult> {
  try {
    const session = await requireAuth();

    await db.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });

    revalidatePath("/dashboard");
    revalidatePath("/notifications");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to mark all as read",
    };
  }
}

export async function getUnreadCount(): Promise<ActionResult<number>> {
  try {
    const session = await requireAuth();

    const count = await db.notification.count({
      where: { userId: session.user.id, read: false },
    });

    return { success: true, data: count };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get unread count",
    };
  }
}
