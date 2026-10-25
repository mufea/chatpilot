import type { PrismaClient } from "@prisma/client";
import { appConfig } from "@/lib/config";
import { logger } from "@/lib/logger";

export type OutboundEmailInput = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  purpose: string;
};

export async function sendEmail(db: PrismaClient, input: OutboundEmailInput): Promise<void> {
  await db.outboundEmail.create({
    data: {
      to: input.to,
      subject: input.subject,
      textBody: input.textBody,
      htmlBody: input.htmlBody,
      purpose: input.purpose,
    },
  });

  if (appConfig.emailDelivery === "console" || appConfig.nodeEnv !== "production") {
    logger.info("email.queued", { purpose: input.purpose });
    if (appConfig.nodeEnv !== "test") {
      console.info(`\n[ChatPilot email:${input.purpose}]\nTo: ${input.to}\nSubject: ${input.subject}\n${input.textBody}\n`);
    }
    return;
  }

  if (!appConfig.smtp.host || !appConfig.smtp.user || !appConfig.smtp.password) {
    throw new Error("SMTP is not configured.");
  }

  const response = await fetch(`smtp://${appConfig.smtp.host}`, {
    method: "POST",
  }).catch(() => null);

  if (!response) {
    throw new Error(
      "SMTP delivery is configured but a production mail transport is not wired yet. Set EMAIL_DELIVERY=console for local development.",
    );
  }
}

export function verificationEmail(appUrl: string, token: string): OutboundEmailInput["textBody"] {
  return [
    "Confirm your ChatPilot AI email address.",
    "",
    `Open this link to verify your account: ${appUrl}/verify-email?token=${encodeURIComponent(token)}`,
    "",
    "This link expires in 24 hours. If you did not create an account, ignore this email.",
  ].join("\n");
}

export function resetEmail(appUrl: string, token: string): string {
  return [
    "Reset your ChatPilot AI password.",
    "",
    `Open this link to choose a new password: ${appUrl}/reset-password?token=${encodeURIComponent(token)}`,
    "",
    "This link expires in 1 hour. If you did not request a reset, ignore this email.",
  ].join("\n");
}

export function invitationEmail(
  appUrl: string,
  organizationName: string,
  token: string,
): string {
  return [
    `You were invited to join ${organizationName} on ChatPilot AI.`,
    "",
    `Accept the invitation: ${appUrl}/accept-invite?token=${encodeURIComponent(token)}`,
    "",
    "This invitation expires in 7 days.",
  ].join("\n");
}
