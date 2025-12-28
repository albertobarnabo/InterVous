import { NextResponse } from "next/server";
import { extractJobTextFromUrl } from "../../../../lib/backend/scrapers/jobScraper";
import { extractFieldsWithOpenAI } from "../../../../lib/backend/llm/openAI";
import { extractFieldsWithDeepSeek } from "../../../../lib/backend/llm/deepSeek";

import { JobEntry } from "../../../../lib/types";
import { extractFieldsWithMistral } from "../../../../lib/backend/llm/mistral";

export async function POST(request: Request) {

    // Helper function
    function isValidUrl(value: string): boolean {
        try {
            new URL(value); // This will throw if invalid
            return true;
        } catch (err) {
            console.log("Invalid URL:", err)
            return false;
        }
    }

    try {
        const { url, applied, model, keys } = await request.json();

        if (
            !url ||
            typeof url !== "string" ||
            !/^https?:\/\/[^ "]+$/.test(url) ||
            !isValidUrl(url)
        ) {
            return NextResponse.json(
                { error: "Please insert a valid URL (starting with http:// or https://)" },
                { status: 400 }
            );
        }

        // Scrape the job posting text
        const jobText = await extractJobTextFromUrl(url);

        if (jobText === null || typeof jobText !== "string" || jobText.trim().length < 100) {
            return NextResponse.json(
                { error: "Failed to extract job text from URL" },
                { status: 500 }
            );
        }

        //  Extract fields with LLM
        let jobFields;
        switch (model) {
            case "gpt-3.5-turbo":
                jobFields = await extractFieldsWithOpenAI(jobText, keys.open_ai);
                break;
            case "deep_seek":
                jobFields = await extractFieldsWithDeepSeek(jobText, keys.deep_seek);
                break;
            case "mistral":
                jobFields = await extractFieldsWithMistral(jobText, keys.mistral)
            default:
                return NextResponse.json(
                    { error: `The model "${model}" does not exist or it's not supported` },
                    { status: 500 }
                );
        }


        // Fill in missing fields
        const fullJobEntry: Omit<JobEntry, "id" | "user_id"> = {
            company_name: jobFields.company,
            role: jobFields.role,
            location: jobFields.location,
            application_date: applied ? new Date().toISOString() : null,
            status: applied ? "Active" : "Not Applied",
            stage: applied ? "Screening" : "-",
            url: url
        };

        return NextResponse.json({ fullJobEntry });

    } catch (error) {
        console.log("❌ Error in /api/scrape-job:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        );
    }
}
