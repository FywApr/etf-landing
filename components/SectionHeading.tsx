import type { ReactNode } from "react";

/** Eyebrow, display heading and optional intro shared by the landing sections. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  tone = "paper",
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  tone?: "paper" | "ink";
  children?: ReactNode;
}) {
  const muted = tone === "ink" ? "text-ink-muted" : "text-muted";
  return (
    <div className="max-w-2xl">
      <p className={`label-mono flex items-center gap-2 ${muted}`}>
        <span
          aria-hidden="true"
          className={`size-2 rounded-[2px] ${tone === "ink" ? "bg-lime" : "bg-ink"}`}
        />
        {eyebrow}
      </p>
      <h2 id={id} className="font-display mt-4 text-display-m font-bold text-balance">
        {title}
      </h2>
      {children && <div className={`mt-4 text-[1.0625rem] leading-relaxed ${muted}`}>{children}</div>}
    </div>
  );
}
