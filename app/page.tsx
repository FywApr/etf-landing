import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "Americká ETF v jedné tabulce",
  description:
    "Porovnejte poplatky, burzu a dostupnost vybraných amerických ETF. Česky a s odkazy na zdroje.",
};

export default function ComparePage() {
  return <LandingPage variant="compare" />;
}
