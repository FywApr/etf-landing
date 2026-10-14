"use server";

import { redirect } from "next/navigation";
import { HONEYPOT_FIELD, type LeadFormState } from "@/lib/lead-form";
import { processLeadSubmission } from "@/lib/leads";

export async function submitLeadAction(
  _previous: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const result = await processLeadSubmission({
    email: formData.get("email"),
    marketingConsent: formData.get("marketingConsent") === "on",
    honeypot: formData.get(HONEYPOT_FIELD),
    startedAt: formData.get("startedAt"),
    variant: formData.get("variant"),
    sessionId: formData.get("sessionId"),
    path: formData.get("path"),
    utm: {
      source: formData.get("utm_source"),
      medium: formData.get("utm_medium"),
      campaign: formData.get("utm_campaign"),
      content: formData.get("utm_content"),
      term: formData.get("utm_term"),
    },
  });

  if (!result.ok) return { error: result.error };

  // The token goes only into the redirect URL. It is never logged or returned.
  redirect(`/dekujeme?t=${result.token}`);
}
