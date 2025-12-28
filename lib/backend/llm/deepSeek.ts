import { OpenAI } from "openai";

interface JobFields {
    company: string;
    role: string;
    location: string;
}

export async function extractFieldsWithDeepSeek(jobText: string, apiKey: string): Promise<JobFields> {

    if (!apiKey || apiKey === "") {
        throw new Error("You have not inserted an API key for this model. Please instert a key or change the moddel");
    }

    const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: apiKey
    });

    const prompt = `
Extract the following information from the job posting below:
- Company
- Role
- Location
Return it as JSON with keys: company, role, location

Job posting:
${jobText}
`;

    try {
        const response = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
        });

        const content = response.choices[0].message?.content || "";

        // Extract JSON from response (handle if wrapped in markdown code block)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON found in LLM response");
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return parsed as JobFields;
    } catch (error) {
        console.warn("⚠️ LLM returned unparsable content or error:", error);
        throw error;
    }
}