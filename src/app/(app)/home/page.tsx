import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeView } from "@/features/today/HomeView";

export const metadata: Metadata = { title: "Home · InterVous" };

/** /home: what to do now, where things stand, and what the numbers say so far. */
export default function HomePage() {
  return (
    <Suspense>
      <HomeView />
    </Suspense>
  );
}
