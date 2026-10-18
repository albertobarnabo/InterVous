import { Suspense } from "react";
import { ApplicationPage } from "@/features/dossier/ApplicationPage";

// /intervous/applications/<slug> (or a numeric id for legacy rows): one application on one page.
// `intervous open` prints this URL. Data loads on the client through lib/data (RLS as the user).
export default async function Page({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return (
    <Suspense>
      <ApplicationPage appRef={ref} />
    </Suspense>
  );
}
