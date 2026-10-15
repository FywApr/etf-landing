import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ArrowIcon } from "@/components/Brand";
import { SimplePage } from "@/components/SimplePage";
import { getDatabaseUrl } from "@/lib/config";
import { createSqlExecutor } from "@/lib/db";
import { guideCookieName } from "@/lib/guide-cookie";
import { GUIDE_TITLE } from "@/lib/guide/contents";
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
        <div className="on-ink relative overflow-hidden rounded-panel bg-ink p-6 md:p-10">
          <div
            aria-hidden="true"
            className="ruled-ink absolute inset-0 [mask-image:linear-gradient(to_bottom_left,black,transparent_70%)]"
          />
          <div className="relative">
            <p className="label-mono flex items-center gap-2 text-lime">
              <span aria-hidden="true" className="size-2 rounded-[2px] bg-lime" />
              PDF ke stažení
            </p>
            <h1 className="font-display mt-5 text-display-m font-bold text-balance">
              Děkujeme, průvodce je připraven
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
              Průvodce americkými ETF pro české investory si můžete stáhnout hned. E-mailem ho
              neposíláme.
            </p>
            <p className="mt-8">
              <a href="/api/guide" download className="btn-lime min-h-14 px-7 text-base">
                Stáhnout průvodce (PDF)
                <ArrowIcon />
              </a>
            </p>
            <p className="mt-6 border-t border-ink-line pt-5 text-sm text-ink-muted">
              V tomto prohlížeči si průvodce můžete stáhnout po dobu {GUIDE_TOKEN_TTL_DAYS} dní.
              Poté si o něj můžete požádat znovu.
            </p>
          </div>
        </div>
        <p className="mt-8 text-muted">
          Mezitím si můžete{" "}
          <Link href="/poplatky" className="link font-medium text-ink">
            spočítat, jak se poplatky projeví na vaší investici
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <div className="rounded-panel border border-line bg-card p-6 md:p-10">
      <p className="label-mono flex items-center gap-2 text-muted">
        <span aria-hidden="true" className="size-2 rounded-[2px] bg-ink" />
        {GUIDE_TITLE}
      </p>
      <h1 className="font-display mt-5 text-display-m font-bold text-balance">
        {state === "invalid" ? "Přístup k průvodci není platný" : "Průvodce je dočasně nedostupný"}
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
        {state === "invalid"
          ? "Přístup vypršel nebo v tomto prohlížeči není k dispozici. O průvodce si můžete požádat znovu."
          : "Zkuste to prosím za chvíli znovu."}
      </p>
      <p className="mt-8">
        <Link href="/#pruvodce" className="btn-ink min-h-14 px-7 text-base">
          Požádat o průvodce
          <ArrowIcon direction="right" />
        </Link>
      </p>
    </div>
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
