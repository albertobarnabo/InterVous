import * as cheerio from "cheerio";
import { FetchError, safeFetchText } from "./safeFetch";

/** How much page text goes to the AI model. */
const MAX_CHARS = 4000;
/** Under this, the page is a shell (JavaScript-only, a sign-in wall), not a posting. */
const MIN_CHARS = 100;

/**
 * Fetches a job page (through the SSRF guard in ./safeFetch) and returns cleaned text for LLM
 * extraction. Throws FetchError, whose message is safe to show and whose status the route returns.
 */
export async function extractJobTextFromUrl(url: string): Promise<{ text: string; finalUrl: string }> {
    const page = await safeFetchText(url);

    let text: string;
    if (/html|xml/i.test(page.contentType) || /^\s*</.test(page.body)) {
        const $ = cheerio.load(page.body);
        $("script, style, noscript, template, svg, iframe").remove();
        text = $("body").text() || $.root().text();
    } else {
        text = page.body;
    }

    const clean = text
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n");

    if (clean.length < MIN_CHARS) {
        throw new FetchError(
            "The page has almost no text: it may need JavaScript or a sign-in. Use Paste JD instead.",
            422,
        );
    }
    return { text: clean.slice(0, MAX_CHARS), finalUrl: page.url };
}
