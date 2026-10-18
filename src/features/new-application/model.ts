// The AI model that reads a job posting for "From link" (POST /intervous/api/scrape-job).
// Chosen on /settings, remembered per browser in localStorage under iv.scrapeModel.
import type { KeyField, KeysStatus } from "../../../lib/keyService";

export type ScrapeModel = "gpt-3.5-turbo" | "deep_seek" | "mistral";

export const SCRAPE_MODELS: ReadonlyArray<{ value: ScrapeModel; label: string; key: KeyField; provider: string }> = [
  { value: "gpt-3.5-turbo", label: "GPT 3.5 Turbo", key: "open_ai", provider: "OpenAI" },
  { value: "deep_seek", label: "DeepSeek", key: "deep_seek", provider: "DeepSeek" },
  { value: "mistral", label: "Mistral", key: "mistral", provider: "Mistral" },
];

export const SCRAPE_MODEL_KEY = "iv.scrapeModel";
export const SCRAPE_MODEL_CHANGED = "iv:scrape-model-changed";

const isModel = (v: unknown): v is ScrapeModel => SCRAPE_MODELS.some((m) => m.value === v);

/** The saved choice, or null when none is saved (or storage is blocked). */
export function readScrapeModel(): ScrapeModel | null {
  try {
    const v = localStorage.getItem(SCRAPE_MODEL_KEY);
    return isModel(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeScrapeModel(m: ScrapeModel) {
  try {
    localStorage.setItem(SCRAPE_MODEL_KEY, m);
  } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SCRAPE_MODEL_CHANGED, { detail: m }));
}

/** The saved choice; else the first model whose key is saved; else GPT 3.5 Turbo. */
export function effectiveScrapeModel(keys: KeysStatus | null): ScrapeModel {
  const saved = readScrapeModel();
  if (saved) return saved;
  return SCRAPE_MODELS.find((m) => keys?.[m.key])?.value ?? "gpt-3.5-turbo";
}

export function scrapeModelInfo(m: ScrapeModel) {
  return SCRAPE_MODELS.find((x) => x.value === m) ?? SCRAPE_MODELS[0];
}
