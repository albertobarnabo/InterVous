import { redirect } from "next/navigation";

// next.config.mjs already redirects / to /today; this is the fallback.
export default function Home() {
  redirect("/today");
}
