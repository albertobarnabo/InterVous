import { redirect } from "next/navigation";

// Insights now live on Home ("What we've learned so far"). next.config.mjs already redirects
// /insights to /home; this is the fallback.
export default function InsightsPage() {
  redirect("/home");
}
