import { terBarShare } from "@/lib/etf-view";

/**
 * Horizontal bar whose length is the fund's expense ratio on a linear scale
 * from zero to `scaleMax`. It shows cost only, never performance. Hatching
 * marks an equal-weight fund; the visible label next to it says why.
 */
export function TerBar({
  valuePct,
  scaleMax,
  equalWeight,
  tone,
  delayMs = 0,
}: {
  valuePct: number;
  scaleMax: number;
  equalWeight: boolean;
  tone: "ink" | "paper";
  delayMs?: number;
}) {
  const track = tone === "ink" ? "bg-ink-line" : "bg-paper-deep";
  const fill =
    tone === "ink"
      ? equalWeight
        ? "hatch text-lime ring-1 ring-inset ring-lime"
        : "bg-lime"
      : equalWeight
        ? "hatch text-ink ring-1 ring-inset ring-ink"
        : "bg-ink";
  return (
    <div aria-hidden="true" className={`h-2 w-full overflow-hidden rounded-full ${track}`}>
      <div
        className={`bar-grow h-full rounded-full ${fill}`}
        style={{
          width: `${terBarShare(valuePct, scaleMax) * 100}%`,
          animationDelay: `${delayMs}ms`,
        }}
      />
    </div>
  );
}
