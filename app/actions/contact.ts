"use server";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email/send";
import { consumeRateLimit } from "@/lib/rate-limit";
import { contactSchema, type FormState } from "@/lib/validators";

export async function contactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    message: formData.get("message"),
  });
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(flattened)) {
      if (value?.length) errors[key] = value;
    }
    return { errors };
  }

  const limit = consumeRateLimit(`contact:${parsed.data.email}`, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return { message: "Too many messages. Please wait a few minutes." };
  }

  await sendEmail(prisma, {
    to: "hello@chatpilot.ai",
    subject: `Website contact from ${parsed.data.name}`,
    textBody: [
      `Name: ${parsed.data.name}`,
      `Email: ${parsed.data.email}`,
      `Company: ${parsed.data.company || "n/a"}`,
      "",
      parsed.data.message,
    ].join("\n"),
    purpose: "contact",
  });

  return { ok: true, message: "Thanks. Your message was recorded and our team will reply by email." };
}
