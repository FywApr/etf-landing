"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { guideCookieName, guideCookieOptions } from "@/lib/guide-cookie";
import { HONEYPOT_FIELD, type LeadFormState } from "@/lib/lead-form";
import { processLeadSubmission } from "@/lib/leads";
import { clientKeyFromHeaders } from "@/lib/rate-limit";

export async function submitLeadAction(
  _previous: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const result = await processLeadSubmission(
    {
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
    },
    { clientKey: clientKeyFromHeaders(await headers()) },
  );

  if (!result.ok) return { error: result.error };

  // The token is handed over only in an HttpOnly cookie, never in a URL, a
  // response body or a log. A newer submission overwrites it.
  (await cookies()).set(guideCookieName(), result.token, guideCookieOptions());
  redirect("/dekujeme");
}
