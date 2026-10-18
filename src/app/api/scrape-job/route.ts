import { NextResponse } from "next/server";
import { extractFieldsWithDeepSeek } from "../../../../lib/backend/llm/deepSeek";
import { extractFieldsWithMistral } from "../../../../lib/backend/llm/mistral";
import { extractFieldsWithOpenAI } from "../../../../lib/backend/llm/openAI";
import { extractJobTextFromUrl } from "../../../../lib/backend/scrapers/jobScraper";
import { FetchError } from "../../../../lib/backend/scrapers/safeFetch";
import { getUserAndKeys } from "../../../../lib/backend/serverKeys";
import type { ApiKeys } from "../../../../lib/types";

// The SSRF guard needs node:dns / node:http(s).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Fields = { company: string; role: string; location: string };
type ModelInfo = { provider: string; key: keyof ApiKeys; run: (text: string, key: string) => Promise<Fields> };

/** The models "From link" can use (src/features/new-application/model.ts lists the same ids). */
const MODELS: Record<string, ModelInfo> = {
  "gpt-3.5-turbo": { provider: "OpenAI", key: "open_ai", run: extractFieldsWithOpenAI },
  deep_seek: { provider: "DeepSeek", key: "deep_seek", run: extractFieldsWithDeepSeek },
  mistral: { provider: "Mistral", key: "mistral", run: extractFieldsWithMistral },
};

/** Every failure answers `{error}` with a sentence the browser shows as it is. */
function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function clip(v: unknown, max = 200): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** An AI-provider error as a sentence. Never forwards the provider's own text (it can quote the key). */
function llmError(e: unknown, provider: string): { error: string; status: number } {
  const o = (e ?? {}) as { status?: unknown; statusCode?: unknown; name?: unknown; code?: unknown };
  const status = Number(o.status ?? o.statusCode ?? 0);
  if (status === 401 || status === 403) return { error: `${provider} rejected the API key. Check it in Settings → API keys.`, status: 400 };
  if (status === 402) return { error: `${provider} says the account has no credit left. Top it up, or pick another model in Settings.`, status: 400 };
  if (status === 429) return { error: `${provider} is rate-limiting this key, or it is out of credit. Try again in a minute.`, status: 429 };
  if (e instanceof SyntaxError || (e instanceof Error && /json/i.test(e.message)))
    return { error: `${provider} answered, but not with the company, role and location. Try again, or use Manual.`, status: 502 };
  if (/connection|timeout|network/i.test(String(o.name)) || /ECONN|ETIMEDOUT|ENOTFOUND/.test(String(o.code)))
    return { error: `${provider} could not be reached. Try again.`, status: 502 };
  return { error: `${provider} could not read the posting. Try again, or use Manual.`, status: 502 };
}

export async function POST(request: Request) {
  let body: { url?: unknown; applied?: unknown; model?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return fail("The request was not valid JSON.", 400);
  }

  // The body is checked first (it reveals nothing); nothing is fetched before the caller is known.
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!/^https?:\/\/\S+$/i.test(url) || !URL.canParse(url)) {
    return fail("Enter a valid link, starting with http:// or https://.", 400);
  }
  const modelId = typeof body?.model === "string" ? body.model : "";
  const model = Object.hasOwn(MODELS, modelId) ? MODELS[modelId] : null;
  if (!model) {
    return fail(`Unknown AI model${modelId ? ` "${clip(modelId, 40)}"` : ""}. Choose one in Settings.`, 400);
  }

  try {
    // Keys are read server-side from the caller's account, never sent by the browser.
    const auth = await getUserAndKeys(request);
    if (!auth) return fail("You are signed out. Sign in again, then try the link.", 401);

    const key = auth.keys?.[model.key];
    if (typeof key !== "string" || !key) {
      return fail(`No ${model.provider} API key is saved. Add one in Settings → API keys, or choose another model there.`, 400);
    }

    let page: { text: string; finalUrl: string };
    try {
      page = await extractJobTextFromUrl(url);
    } catch (e) {
      if (e instanceof FetchError) return fail(e.message, e.status);
      console.error("scrape-job: fetch failed:", e instanceof Error ? e.name : typeof e);
      return fail("The page could not be fetched. Check the link, or use Paste JD.", 502);
    }

    let fields: Fields;
    try {
      fields = await model.run(page.text, key);
    } catch (e) {
      const { error, status } = llmError(e, model.provider);
      return fail(error, status);
    }

    const company = clip(fields?.company);
    const role = clip(fields?.role);
    const location = clip(fields?.location);
    if (!company && !role) {
      return fail(`${model.provider} found no company or role on that page. Check the link, or use Paste JD.`, 422);
    }

    const applied = body?.applied === true;
    return NextResponse.json({
      fullJobEntry: {
        company_name: company,
        role,
        location,
        url,
        phase: applied ? "applied" : "draft",
        application_date: applied ? new Date().toISOString() : null,
      },
    });
  } catch (error) {
    console.error("scrape-job failed:", error instanceof Error ? error.name : typeof error);
    return fail("Something went wrong while reading the posting. Try again.", 500);
  }
}
