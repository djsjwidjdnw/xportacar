import "server-only";
import { getResendClient } from "./client";

// Push a marketing email into the pre-launch Resend audience for the launch
// announcement campaign. Best-effort: returns the contact id on success, or
// null (logged) if Resend isn't configured or the call fails — the caller still
// stores the signup in Supabase so we never lose a lead.
//
// Requires RESEND_PRELAUNCH_AUDIENCE_ID (create the audience at
// https://resend.com/audiences and set the id in the environment).
export async function addToPrelaunchAudience(email: string): Promise<string | null> {
  const audienceId = process.env.RESEND_PRELAUNCH_AUDIENCE_ID;
  const client = getResendClient();
  if (!client || !audienceId) {
    console.warn(
      `[prelaunch] Resend audience push skipped (${!client ? "RESEND_API_KEY" : "RESEND_PRELAUNCH_AUDIENCE_ID"} unset) — stored in Supabase only.`,
    );
    return null;
  }
  try {
    const { data, error } = await client.contacts.create({
      email,
      audienceId,
      unsubscribed: false,
    });
    if (error) {
      console.error(`[prelaunch] Resend contacts.create failed for ${email}: ${error.message ?? error}`);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error(`[prelaunch] Resend contacts.create threw for ${email}: ${(err as Error)?.message ?? err}`);
    return null;
  }
}
