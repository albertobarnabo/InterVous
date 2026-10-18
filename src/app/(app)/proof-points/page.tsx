import { redirect } from "next/navigation";

// Proof points are no longer a page of their own: old links land on Home.
export default function ProofPointsPage() {
  redirect("/home");
}
