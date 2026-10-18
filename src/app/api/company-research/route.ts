import { NextResponse } from 'next/server';
import { getUserAndKeys } from '../../../../lib/backend/serverKeys';

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
        let body: { companyName?: unknown; website?: unknown };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'The request was not valid JSON.' }, { status: 400 });
        }
        const companyName = typeof body.companyName === 'string' ? body.companyName.trim().slice(0, 200) : '';
        const website = typeof body.website === 'string' ? body.website.trim().slice(0, 300) : '';

        if (!companyName) {
            return NextResponse.json({ error: 'Add the company name first.' }, { status: 400 });
        }

        // Tavily key is read server-side from the caller's account
        const auth = await getUserAndKeys(req);
        if (!auth) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        const apiKey = auth.keys?.tavily;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'No Tavily API key is saved. Add one in Settings → API keys.' },
                { status: 400 }
            );
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
                { error: 'Tavily rejected the API key. Check it in Settings → API keys.' },
                { status: 401 }
            );
        }
        console.error('Company research failed:', err instanceof Error ? err.message : typeof err);
        return NextResponse.json(
            { error: 'Company research failed. Try again.' },
            { status: 500 }
        );
    }
}
