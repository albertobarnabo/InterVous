import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Fetches a job page and returns cleaned text for LLM extraction.
 * @param url - The URL of the job posting.
 * @returns A cleaned, trimmed string with relevant page content.
 */
export async function extractJobTextFromUrl(url: string): Promise<string | null> {
    try {
        const response = await axios.get(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
            },
            timeout: 10000,
        });

        const html = response.data;
        const $ = cheerio.load(html);

        // Remove <script> and <style> tags
        $("script, style").remove();

        // Extract and clean text
        const rawText = $("body").text();
        const lines = rawText.split("\n").map(line => line.trim()).filter(Boolean);
        const cleanText = lines.join("\n");

        // Trim to 4000 chars for LLM input
        return cleanText.slice(0, 4000);
    } catch (error) {
        console.error("❌ Failed to fetch or parse page:", error);
        return null;
    }
}
