"use server";

import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { signIn, signOut } from "@/lib/auth";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";
import { requireAuth } from "@/lib/session";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@/schemas";
import type { ActionResult } from "@/types";

function mapPrismaAuthError(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Database is unavailable. Start PostgreSQL and try again.";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "Email already in use";
    }
    if (error.code === "P1001") {
      return "Database is unavailable. Start PostgreSQL and try again.";
    }
  }

  return null;
}

export async function register(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = registerSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const { name, email, password } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: "Email already in use" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const token = nanoid(32);

    await db.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      await tx.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    await sendVerificationEmail(email, token);

    return { success: true, data: undefined };
  } catch (error) {
    const mappedError = mapPrismaAuthError(error);
    if (mappedError) {
      return { success: false, error: mappedError };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Registration failed",
    };
  }
}

export async function login(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = loginSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });

    revalidatePath("/dashboard");
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof AuthError) {
      return { success: false, error: "Invalid email or password" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Login failed",
    };
  }
}

export async function logout(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/");
}

export async function forgotPassword(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const { email } = parsed.data;
    const user = await db.user.findUnique({ where: { email } });

    if (user) {
      await db.passwordResetToken.deleteMany({ where: { email } });

      const token = nanoid(32);
      await db.passwordResetToken.create({
        data: {
          email,
          token,
          expires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      await sendPasswordResetEmail(email, token);
    }

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const { token, password } = parsed.data;

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken || resetToken.expires < new Date()) {
      return { success: false, error: "Invalid or expired token" };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.user.update({
      where: { email: resetToken.email },
      data: { password: hashedPassword },
    });

    await db.passwordResetToken.delete({ where: { id: resetToken.id } });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Reset failed",
    };
  }
}

export async function verifyEmail(token: string): Promise<ActionResult> {
  try {
    const verificationToken = await db.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.expires < new Date()) {
      return { success: false, error: "Invalid or expired token" };
    }

    await db.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    });

    await db.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
        },
      },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

export async function changePassword(formData: FormData): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user?.password) {
      return { success: false, error: "Password login not available for this account" };
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password);
    if (!valid) {
      return { success: false, error: "Current password is incorrect" };
    }

    const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12);

    await db.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    revalidatePath("/settings/profile");
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Password change failed",
    };
  }
}
