// Constants and types shared by the lead form (browser) and lib/leads.ts
// (server). Kept free of server-only imports so the form can use them.

import type { FORM_ERROR_CATEGORIES } from "@/lib/analytics/events";

export type LeadErrorCode = (typeof FORM_ERROR_CATEGORIES)[number];

/** State returned to the form by the server action. Null means no error yet. */
export interface LeadFormState {
  error: LeadErrorCode | null;
}

/** Hidden field that people leave empty and naive bots fill in. */
export const HONEYPOT_FIELD = "company";
