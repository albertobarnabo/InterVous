import type { Metadata } from "next";
import ProofPointsView from "./_components/ProofPointsView";

export const metadata: Metadata = { title: "Proof points · InterVous" };

export default function ProofPointsPage() {
  return <ProofPointsView />;
}
