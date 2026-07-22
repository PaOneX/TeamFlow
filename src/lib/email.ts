import { Resend } from "resend";
import { absoluteUrl } from "@/utils/helpers";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const from = process.env.EMAIL_FROM || "TeamFlow <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.log(`[EMAIL SKIPPED] To: ${to} | Subject: ${subject}`);
    return { success: true };
  }
  try {
    await resend.emails.send({ from, to, subject, html });
    return { success: true };
  } catch (error) {
    console.error("Email send failed:", error);
    return { success: false };
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = absoluteUrl(`/verify-email?token=${token}`);
  return sendEmail(
    email,
    "Verify your TeamFlow email",
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h1>Welcome to TeamFlow</h1>
      <p>Click the button below to verify your email address.</p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">Verify Email</a>
      <p style="color:#666;font-size:14px;margin-top:24px">Or copy this link: ${url}</p>
    </div>`
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = absoluteUrl(`/reset-password?token=${token}`);
  return sendEmail(
    email,
    "Reset your TeamFlow password",
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h1>Password Reset</h1>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a>
      <p style="color:#666;font-size:14px;margin-top:24px">If you did not request this, ignore this email.</p>
    </div>`
  );
}

export async function sendInvitationEmail(
  email: string,
  orgName: string,
  token: string,
  inviterName: string
) {
  const url = absoluteUrl(`/invite/${token}`);
  return sendEmail(
    email,
    `You are invited to join ${orgName} on TeamFlow`,
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h1>Organization Invitation</h1>
      <p>${inviterName} invited you to join <strong>${orgName}</strong> on TeamFlow.</p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">Accept Invitation</a>
    </div>`
  );
}

export async function sendMentionEmail(
  email: string,
  mentionerName: string,
  taskTitle: string,
  taskId: string
) {
  const url = absoluteUrl(`/tasks/${taskId}`);
  return sendEmail(
    email,
    `${mentionerName} mentioned you on TeamFlow`,
    `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h1>You were mentioned</h1>
      <p>${mentionerName} mentioned you in a comment on task <strong>${taskTitle}</strong>.</p>
      <a href="${url}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px">View Task</a>
    </div>`
  );
}
