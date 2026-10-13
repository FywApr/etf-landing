import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "Kolik vás stojí poplatky ETF za 20 let?",
  description:
    "Zadejte vklad a horizont. Kalkulačka ukáže, jak se poplatky mohou projevit na konečné hodnotě investice.",
};

export default function FeesPage() {
  return <LandingPage variant="fees" />;
}
