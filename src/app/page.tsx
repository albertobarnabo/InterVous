import { redirect } from "next/navigation";

// next.config.mjs already redirects / to /home; this is the fallback.
export default function Home() {
  redirect("/home");
}
