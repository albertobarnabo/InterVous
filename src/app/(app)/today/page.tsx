import { redirect } from "next/navigation";

// Today became Home. next.config.mjs already redirects /today to /home; this is the fallback.
export default function TodayPage() {
  redirect("/home");
}
