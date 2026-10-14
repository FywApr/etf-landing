import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SimplePage } from "@/components/SimplePage";
import { getDatabaseUrl } from "@/lib/config";
import { createSqlExecutor } from "@/lib/db";
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
    logServerError("thank-you", error);
    return "unavailable";
  }
}

async function GuideAccess({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t: token } = await searchParams;
  const state = await checkAccess(token);

  if (state === "valid" && typeof token === "string") {
    return (
      <>
        <h1 className="text-3xl font-semibold tracking-tight">Děkujeme, průvodce je připraven</h1>
        <p className="mt-3 text-muted">
          Průvodce americkými ETF pro české investory si můžete stáhnout hned. E-mailem ho
          neposíláme.
        </p>
        <p className="mt-6">
          <a
            href={`/api/guide?token=${encodeURIComponent(token)}`}
            download
            className="inline-flex h-12 items-center rounded-md bg-accent px-5 text-base font-semibold text-white hover:bg-accent-strong"
          >
            Stáhnout průvodce (PDF)
          </a>
        </p>
        <p className="mt-4 text-sm text-muted">
          Odkaz na této stránce platí {GUIDE_TOKEN_TTL_DAYS} dní. Poté si o průvodce můžete
          požádat znovu.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">
        {state === "invalid" ? "Odkaz není platný" : "Průvodce je dočasně nedostupný"}
      </h1>
      <p className="mt-3 text-muted">
        {state === "invalid"
          ? "Odkaz je neplatný nebo jeho platnost vypršela. O průvodce si můžete požádat znovu."
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

export default function ThankYouPage({ searchParams }: PageProps<"/dekujeme">) {
  return (
    <SimplePage>
      <Suspense fallback={<p className="text-muted">Ověřujeme odkaz…</p>}>
        <GuideAccess searchParams={searchParams} />
      </Suspense>
    </SimplePage>
  );
}
