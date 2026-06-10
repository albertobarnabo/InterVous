import { NextResponse } from 'next/server';

const TAVILY_URL = 'https://api.tavily.com/search';

async function tavilyAnswer(
    apiKey: string,
    query: string,
    depth: 'basic' | 'advanced' = 'basic'
): Promise<string> {
    const res = await fetch(TAVILY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            query,
            search_depth: depth,
            include_answer: true,
            max_results: 3,
        }),
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error('INVALID_KEY');
    }
    if (!res.ok) {
        throw new Error(`Tavily request failed (${res.status})`);
    }

    const data = await res.json();
    return typeof data.answer === 'string' ? data.answer.trim() : '';
}

export async function POST(req: Request) {
    try {
        const { companyName, website, apiKey } = await req.json();

        if (!apiKey) {
            return NextResponse.json({ error: 'Missing Tavily API key' }, { status: 400 });
        }
        if (!companyName) {
            return NextResponse.json({ error: 'Missing company name' }, { status: 400 });
        }

        const site = website ? ` (website: ${website})` : '';
        const subject = `the company "${companyName}"${site}`;

        const [description, industry, headquarters, founded, employee_count] =
            await Promise.all([
                tavilyAnswer(apiKey, `What does ${subject} do? Give a brief 2-3 sentence overview of its products and business.`, 'advanced'),
                tavilyAnswer(apiKey, `What industry or sector is ${subject} in? Answer in a few words.`),
                tavilyAnswer(apiKey, `Where is ${subject} headquartered? Answer with city and country only.`),
                tavilyAnswer(apiKey, `In what year was ${subject} founded? Answer with the year only.`),
                tavilyAnswer(apiKey, `Approximately how many employees does ${subject} have? Answer briefly, e.g. "about 5,000".`),
            ]);

        return NextResponse.json({
            description,
            industry,
            headquarters,
            founded,
            employee_count,
        });
    } catch (err) {
        if (err instanceof Error && err.message === 'INVALID_KEY') {
            return NextResponse.json(
                { error: 'Tavily rejected the API key. Check it in Configs.' },
                { status: 401 }
            );
        }
        console.error('Company research failed:', err);
        return NextResponse.json(
            { error: 'Company research failed. Try again.' },
            { status: 500 }
        );
    }
}
