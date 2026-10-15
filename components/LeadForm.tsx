"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { submitLeadAction } from "@/app/actions/submit-lead";
import { getSession, track, trackOnce } from "@/lib/analytics/client";
import { MARKETING_CONSENT } from "@/lib/consent";
import { HONEYPOT_FIELD, type LeadErrorCode, type LeadFormState } from "@/lib/lead-form";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ERROR_MESSAGES: Record<LeadErrorCode, string> = {
  email_missing: "Zadejte svůj e-mail.",
  email_invalid: "Zadejte e-mail ve tvaru jmeno@domena.cz.",
  unavailable:
    "Formulář je dočasně nedostupný a váš e-mail jsme neuložili. Zkuste to prosím později.",
  rejected: "Odeslání se nezdařilo. Počkejte chvíli a zkuste to prosím znovu.",
  rate_limited:
    "Z vašeho připojení přišlo příliš mnoho pokusů. Zkuste to prosím znovu za několik minut.",
  server: "Odeslání se nezdařilo a váš e-mail jsme neuložili. Zkuste to prosím znovu.",
};

const INITIAL_STATE: LeadFormState = { error: null };

function isEmailError(code: LeadErrorCode | null): boolean {
  return code === "email_missing" || code === "email_invalid";
}

export function LeadForm() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [clientError, setClientError] = useState<LeadErrorCode | null>(null);
  const [serverState, formAction, pending] = useActionState(submitLeadAction, INITIAL_STATE);
  const startedAt = useRef(0);

  // When the form became usable; the server rejects implausibly fast submissions.
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  // Report only the error category, never the value that caused it.
  useEffect(() => {
    if (serverState.error) track("form_error", { category: serverState.error });
  }, [serverState]);

  const submit = (formData: FormData) => {
    const trimmed = email.trim();
    const problem: LeadErrorCode | null =
      trimmed === "" ? "email_missing" : EMAIL_PATTERN.test(trimmed) ? null : "email_invalid";
    setClientError(problem);
    if (problem) {
      track("form_error", { category: problem });
      return;
    }

    track("form_submit");
    const session = getSession();
    formData.set("startedAt", String(startedAt.current));
    formData.set("sessionId", session.sessionId);
    formData.set("variant", session.variant);
    formData.set("path", window.location.pathname);
    for (const [key, value] of Object.entries(session.utm)) {
      formData.set(`utm_${key}`, value);
    }
    // The server validates everything again; this only attaches context.
    formAction(formData);
  };

  const error = clientError ?? serverState.error;
  const emailError = isEmailError(error) ? error : null;
  const formError = error && !emailError ? error : null;

  return (
    <form
      noValidate
      action={submit}
      onFocus={() => trackOnce("form_start")}
      className="grid gap-4"
    >
      <div>
        <label htmlFor={emailId} className="block text-sm font-medium">
          E-mail
        </label>
        <input
          id={emailId}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? `${emailId}-error` : undefined}
          placeholder="jmeno@domena.cz"
          className={`mt-1.5 h-14 w-full rounded-control border bg-ink px-4 text-lg text-paper placeholder:text-ink-muted ${
            emailError ? "border-2 border-danger-on-ink" : "border-ink-line-strong"
          }`}
        />
        {emailError && (
          <p id={`${emailId}-error`} className="mt-1.5 text-sm font-medium text-danger-on-ink">
            {ERROR_MESSAGES[emailError]}
          </p>
        )}
      </div>

      {/* Honeypot: hidden from people and assistive technology, tempting for bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Firma
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink-muted">
        <input
          type="checkbox"
          name="marketingConsent"
          checked={marketingConsent}
          onChange={(event) => setMarketingConsent(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-lime"
        />
        <span>
          <span className="text-paper">{MARKETING_CONSENT.text}</span> (Nepovinné.)
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="btn-lime min-h-14 w-full text-base disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Odesílám…" : "Chci průvodce"}
      </button>

      <p role="status" className="text-sm empty:-mt-4">
        {formError && !pending && (
          <span className="block rounded-control border border-danger-on-ink/70 p-3 text-danger-on-ink">
            {ERROR_MESSAGES[formError]}
          </span>
        )}
      </p>

      <p className="text-xs leading-relaxed text-ink-muted">
        Průvodce si stáhnete hned na další stránce, e-mailem ho neposíláme.{" "}
        <Link href="/ochrana-osobnich-udaju" className="link text-paper">
          Jak zpracováváme osobní údaje
        </Link>
        .
      </p>
    </form>
  );
}
