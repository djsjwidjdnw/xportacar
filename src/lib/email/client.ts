// Resend transport. Server-only. Never throws — a skipped or failed email must
// not break the host server action (signup, KYC review, payment verify, ...).
//
// If RESEND_API_KEY is not set we no-op (and log once in dev) so development and
// preview environments work without an email provider configured.

import "server-only";
import { Resend } from "resend";
import type { EmailContent } from "./templates/layout";

const FROM = process.env.RESEND_FROM ?? "XportACar <noreply@xportacar.com>";

let cached: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

// Shared accessor for non-email Resend features (e.g. audiences/contacts).
// Returns null when RESEND_API_KEY is unset so callers can degrade gracefully.
export function getResendClient(): Resend | null {
  return getClient();
}

export interface EmailAttachment { filename: string; content: Buffer; contentType?: string }

export async function sendEmail(
  to: string,
  content: EmailContent,
  attachments?: EmailAttachment[],
): Promise<{ sent: boolean }> {
  const client = getClient();
  if (!client) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[email] RESEND_API_KEY not set — skipped "${content.subject}" → ${to}`);
    }
    return { sent: false };
  }
  try {
    const { error } = await client.emails.send({
      from: FROM,
      to,
      subject: content.subject,
      html: content.html,
      text: content.text,
      ...(attachments && attachments.length ? { attachments } : {}),
    });
    if (error) {
      console.error(`[email] Resend rejected "${content.subject}" → ${to}: ${error.message ?? error}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error(`[email] send threw for "${content.subject}" → ${to}: ${(err as Error)?.message ?? err}`);
    return { sent: false };
  }
}
