import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Primitives · InterVous dev" };

/** /intervous/dev/ui: every primitive in light and dark. Development builds only (the gallery is not even bundled otherwise). */
export default async function DevUiPage() {
  if (process.env.NODE_ENV === "development") {
    const { default: Gallery } = await import("./Gallery");
    return <Gallery />;
  }
  notFound();
}
