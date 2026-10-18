import type { Metadata } from "next";
import { Suspense } from "react";
import { ApplicationsScreen } from "@/features/applications/ApplicationsScreen";

export const metadata: Metadata = { title: "Applications · InterVous" };

/** /applications: every application, grouped by where it stands (docs/SPEC.md 2.2). */
export default function ApplicationsPage() {
  // The screen reads the view and filters from the URL query (useSearchParams needs a Suspense boundary).
  return (
    <Suspense fallback={null}>
      <ApplicationsScreen />
    </Suspense>
  );
}
