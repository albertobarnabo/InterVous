import type { Metadata } from "next";
import { Suspense } from "react";
import CompaniesView from "./_components/CompaniesView";

export const metadata: Metadata = { title: "Companies · InterVous" };

export default function CompaniesPage() {
  return (
    <Suspense>
      <CompaniesView />
    </Suspense>
  );
}
