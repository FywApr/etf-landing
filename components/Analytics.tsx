"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { track, trackOnce } from "@/lib/analytics/client";
import type { CTA_PLACEMENTS, CTA_TARGETS } from "@/lib/analytics/events";

/** Mounted once in the root layout: records the first page view and each route change. */
export function PageViewTracker() {
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    track("page_view");
  }, [pathname]);

  return null;
}

/** Invisible marker that reports the comparison once it is well inside the viewport. */
export function ComparisonViewMarker() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          trackOnce("comparison_view");
          observer.disconnect();
        }
      },
      // Ignore the bottom 30 % of the viewport so a sliver of the section does not count.
      { rootMargin: "0px 0px -30% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <span ref={ref} aria-hidden="true" className="block h-px" />;
}

export function TrackedLink({
  href,
  placement,
  target,
  className,
  children,
}: {
  href: string;
  placement: (typeof CTA_PLACEMENTS)[number];
  target: (typeof CTA_TARGETS)[number];
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className} onClick={() => track("cta_click", { placement, target })}>
      {children}
    </a>
  );
}
