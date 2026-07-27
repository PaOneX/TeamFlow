"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/session";
import { profileSchema } from "@/schemas";
import type { ActionResult } from "@/types";

export async function updateProfile(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const parsed = profileSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    await db.user.update({
      where: { id: session.user.id },
      data: {
        name: parsed.data.name,
        image: parsed.data.image ?? undefined,
      },
    });

    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update profile",
    };
  }
}

export async function updateAvatar(url: string): Promise<ActionResult> {
  try {
    const session = await requireAuth();

    await db.user.update({
      where: { id: session.user.id },
      data: { image: url },
    });

    revalidatePath("/settings/profile");
    revalidatePath("/dashboard");

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update avatar",
    };
  }
}
