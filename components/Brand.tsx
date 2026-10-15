import Link from "next/link";

/**
 * Original mark: three horizontal bars of different lengths, the same motif
 * as the TER bars. Decorative; the wordmark next to it carries the name.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className={`size-7 shrink-0 ${className}`}>
      <rect width="28" height="28" rx="8" fill="var(--lime)" />
      <rect x="6" y="7.5" width="16" height="3" rx="1.5" fill="var(--ink)" />
      <rect x="6" y="12.5" width="9" height="3" rx="1.5" fill="var(--ink)" />
      <rect x="6" y="17.5" width="12.5" height="3" rx="1.5" fill="var(--ink)" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-2.5 rounded-md text-[1.0625rem] font-semibold tracking-tight"
    >
      <BrandMark />
      Americká ETF
    </Link>
  );
}

/** Small arrow used inside primary actions. */
export function ArrowIcon({ direction = "down" }: { direction?: "down" | "right" | "up-right" }) {
  const rotate = { down: "rotate-90", right: "", "up-right": "-rotate-45" }[direction];
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-4 shrink-0 ${rotate}`}>
      <path
        d="M2 8h11M9 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
