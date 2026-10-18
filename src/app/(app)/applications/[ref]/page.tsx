import { Suspense } from "react";
import { DossierPage } from "@/features/dossier/DossierPage";

// /intervous/applications/<slug> (or a numeric id for legacy rows): one application's dossier.
// `intervous open` prints this URL. Data loads on the client through lib/data (RLS as the user).
export default async function Page({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return (
    <Suspense>
      <DossierPage appRef={ref} />
    </Suspense>
  );
}
