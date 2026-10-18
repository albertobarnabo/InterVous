import { Mistral } from '@mistralai/mistralai';

interface JobFields {
    company: string;
    role: string;
    location: string;
}

export async function extractFieldsWithMistral(jobText: string, apiKey: string): Promise<JobFields> {

    if (!apiKey || apiKey === "") {
        throw new Error("No API key saved for this model. Add one in Settings.");
    }

    const client = new Mistral({
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
        const response = await client.chat.complete({
            model: "mistral-medium-latest",
            messages: [{ role: "user", content: prompt }],
            temperature: 0,
            responseFormat: { type: 'json_object' },
        });

        if (!response.choices || response.choices.length === 0) {
            throw new Error("No choices returned from LLM");
        }

        const rawContent = response.choices[0].message?.content;

        const content = Array.isArray(rawContent)
            ? rawContent
                .filter(chunk => chunk.type === 'text')
                .map(chunk => (chunk as { type: 'text'; text: string }).text)
                .join('')
            : rawContent || '';

        // Extract JSON from response (handle if wrapped in markdown code block)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON found in LLM response");
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return parsed as JobFields;
    } catch (error) {
        // The route turns this into a message for the browser; never log the error object (it carries request details).
        console.warn("LLM extraction failed:", error instanceof Error ? error.name : typeof error);
        throw error;
    }
}
