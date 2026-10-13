"use client";

import { useId, useState, type FormEvent } from "react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LeadDraft {
  email: string;
  marketingConsent: boolean;
}

type SubmitState = "idle" | "not-connected";

// Integration point for lead capture. Nothing is sent or stored yet: replace
// this with the real submission (server action) when the backend exists.
function submitLead(draft: LeadDraft): SubmitState {
  void draft;
  return "not-connected";
}

export function LeadForm() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SubmitState>("idle");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (trimmed === "") {
      setError("Zadejte svůj e-mail.");
      setState("idle");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError("Zadejte e-mail ve tvaru jmeno@domena.cz.");
      setState("idle");
      return;
    }
    setError(null);
    setState(submitLead({ email: trimmed, marketingConsent }));
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-4">
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${emailId}-error` : undefined}
          placeholder="jmeno@domena.cz"
          className={`mt-1 h-12 w-full rounded-md border bg-background px-3 text-base ${
            error ? "border-danger" : "border-line"
          }`}
        />
        {error && (
          <p id={`${emailId}-error`} className="mt-1 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="marketingConsent"
          checked={marketingConsent}
          onChange={(event) => setMarketingConsent(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-accent"
        />
        <span>
          Chci dostávat e-mailem i další vzdělávací obsah o ETF.{" "}
          <span className="text-muted">Nepovinné, na získání průvodce nemá vliv.</span>
        </span>
      </label>

      <button
        type="submit"
        className="h-12 rounded-md bg-accent px-5 text-base font-semibold text-white hover:bg-accent-strong"
      >
        Chci průvodce
      </button>

      <p role="status" className="text-sm">
        {state === "not-connected" && (
          <span className="block rounded-md border border-line bg-surface p-3">
            Formulář zatím není zapojený. Váš e-mail jsme neuložili ani nikam neodeslali a
            průvodce zatím není ke stažení.
          </span>
        )}
      </p>
    </form>
  );
}
