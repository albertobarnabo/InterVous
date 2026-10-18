import type { Metadata } from "next";
import { Suspense } from "react";
import { TodayView } from "@/features/today/TodayView";

export const metadata: Metadata = { title: "Today · InterVous" };

export default function TodayPage() {
  return (
    <Suspense>
      <TodayView />
    </Suspense>
  );
}
