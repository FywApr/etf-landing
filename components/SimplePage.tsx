import Link from "next/link";
import type { ReactNode } from "react";

const footerLink = "inline-flex h-11 items-center underline underline-offset-4";

/** Header and footer for the secondary pages (thank-you, privacy notice). */
export function SimplePage({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-base font-semibold tracking-tight">
            Americká ETF
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-md px-2.5 text-sm text-muted hover:bg-surface hover:text-foreground"
          >
            Zpět na srovnání
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 md:py-14">{children}</main>
      <footer className="border-t border-line py-8 text-sm">
        <nav aria-label="Navigace v patičce" className="mx-auto w-full max-w-3xl px-4">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
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
