import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Brand";

const footerLink = "link inline-flex min-h-11 items-center";

/** Header and footer for the secondary pages (thank-you, privacy notice). */
export function SimplePage({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="on-ink bg-ink">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Wordmark />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-md px-2.5 text-sm text-ink-muted transition-colors hover:text-paper"
          >
            Zpět na srovnání
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-6 md:py-20">
        {children}
      </main>
      <footer className="bg-paper-deep py-8 text-sm">
        <nav aria-label="Navigace v patičce" className="mx-auto w-full max-w-3xl px-4 md:px-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            <li>
              <Link href="/" className={footerLink}>
                Srovnání ETF
              </Link>
            </li>
            <li>
              <Link href="/poplatky" className={footerLink}>
                Kalkulačka poplatků
              </Link>
            </li>
            <li>
              <Link href="/ochrana-osobnich-udaju" className={footerLink}>
                Ochrana osobních údajů
              </Link>
            </li>
          </ul>
        </nav>
      </footer>
    </>
  );
}
