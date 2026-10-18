import type { Metadata } from "next";
import { Suspense } from "react";
import { InsightsView } from "@/features/insights/InsightsView";

export const metadata: Metadata = { title: "Insights · InterVous" };

export default function InsightsPage() {
  return (
    <Suspense>
      <InsightsView />
    </Suspense>
  );
}
