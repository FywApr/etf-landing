import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { SimplePage } from "@/components/SimplePage";
import { getDatabaseUrl } from "@/lib/config";
import { createSqlExecutor } from "@/lib/db";
import { guideCookieName } from "@/lib/guide-cookie";
import { findGuideAccess } from "@/lib/guide/download";
import { GUIDE_TOKEN_TTL_DAYS, isWellFormedGuideToken } from "@/lib/guide-token";
import { logServerError } from "@/lib/log";

export const metadata: Metadata = {
  title: "Průvodce je připraven ke stažení",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type AccessState = "valid" | "invalid" | "unavailable";

async function checkAccess(token: unknown): Promise<AccessState> {
  if (!isWellFormedGuideToken(token)) return "invalid";
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) return "unavailable";
  try {
    return (await findGuideAccess(createSqlExecutor(databaseUrl), token)) ? "valid" : "invalid";
  } catch (error) {
    // Next.js aborts I/O when a prerender pass ends and expects that rejection
    // to propagate. The Neon driver wraps it, so check the wrapped error too.
    unstable_rethrow(error);
    if (error instanceof Error && "sourceError" in error) unstable_rethrow(error.sourceError);
    logServerError("thank-you", error);
    return "unavailable";
  }
}

// The token is read from the HttpOnly cookie set by the lead form; this page's
// URL never contains it.
async function GuideAccess() {
  const token = (await cookies()).get(guideCookieName())?.value;
  const state = await checkAccess(token);

  if (state === "valid") {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight">Děkujeme, průvodce je připraven</h1>
        <p className="mt-3 text-muted">
          Průvodce americkými ETF pro české investory si můžete stáhnout hned. E-mailem ho
          neposíláme.
        </p>
        <p className="mt-6">
          <a
            href="/api/guide"
            download
            className="inline-flex h-12 items-center rounded-md bg-accent px-5 text-base font-semibold text-white hover:bg-accent-strong"
          >
            Stáhnout průvodce (PDF)
          </a>
        </p>
        <p className="mt-4 text-sm text-muted">
          V tomto prohlížeči si průvodce můžete stáhnout po dobu {GUIDE_TOKEN_TTL_DAYS} dní. Poté
          si o něj můžete požádat znovu.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        {state === "invalid" ? "Přístup k průvodci není platný" : "Průvodce je dočasně nedostupný"}
      </h1>
      <p className="mt-3 text-muted">
        {state === "invalid"
          ? "Přístup vypršel nebo v tomto prohlížeči není k dispozici. O průvodce si můžete požádat znovu."
          : "Zkuste to prosím za chvíli znovu."}
      </p>
      <p className="mt-6">
        <Link
          href="/#pruvodce"
          className="inline-flex h-12 items-center rounded-md bg-accent px-5 text-base font-semibold text-white hover:bg-accent-strong"
        >
          Požádat o průvodce
        </Link>
      </p>
    </>
  );
}

export default function ThankYouPage() {
  return (
    <SimplePage>
      <Suspense fallback={<p className="text-muted">Ověřujeme odkaz…</p>}>
        <GuideAccess />
      </Suspense>
    </SimplePage>
  );
}
