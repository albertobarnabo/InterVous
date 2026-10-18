// GET /intervous/dev/fixture: the dev fixture for lib/data (NEXT_PUBLIC_FIXTURES=1 under `next dev`).
// Reads lib/core/test/fixture.json (or IV_FIXTURE_FILE) at request time, so the file is never bundled.
// In any production build this handler is a constant 404: the fs branch is removed at compile time.
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_FIXTURES === "1") {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const file = process.env.IV_FIXTURE_FILE || join(process.cwd(), "lib", "core", "test", "fixture.json");
    try {
      const text = await readFile(file, "utf8");
      return new Response(text, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    } catch {
      const { PLACEHOLDER_FIXTURE } = await import("./placeholder");
      return Response.json(PLACEHOLDER_FIXTURE, { headers: { "cache-control": "no-store" } });
    }
  }
  return new Response("Not found", { status: 404 });
}
