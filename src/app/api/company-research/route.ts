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

const FETCH_TIMEOUT_MS = 6000;
const UA = 'Mozilla/5.0 (compatible; InterVous/1.0; +https://albertobarnabo.com/intervous)';

/* A public hostname like "acme.com": no IPs, no localhost, no ports (the server fetches it). */
function cleanDomain(raw: string): string | null {
    const m = raw.toLowerCase().match(/(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})/);
    if (!m) return null;
    const d = m[1];
    if (d === 'localhost' || d.endsWith('.local') || d.endsWith('.internal')) return null;
    return d;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response | null> {
    try {
        return await fetch(url, {
            ...init,
            redirect: 'follow',
            headers: { 'User-Agent': UA, ...(init.headers ?? {}) },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
    } catch {
        return null;
    }
}

/* True when the URL answers with an actual image. */
async function isImage(url: string): Promise<boolean> {
    const res = await fetchWithTimeout(url);
    if (!res?.ok) return false;
    const type = res.headers.get('content-type') ?? '';
    const len = Number(res.headers.get('content-length') ?? '0');
    void res.body?.cancel();
    return type.startsWith('image/') && (len === 0 || len > 200);
}

/* Icon links on the homepage, best first: apple-touch-icon, then SVG, then the largest sized icon. */
function iconCandidates(html: string, base: string): string[] {
    const found: { url: string; score: number }[] = [];
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
        const rel = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1].toLowerCase() ?? '';
        const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
        if (!href || !/icon/.test(rel)) continue;
        let url: string;
        try {
            url = new URL(href, base).toString();
        } catch {
            continue;
        }
        if (!url.startsWith('https://')) continue;
        const size = Number(tag.match(/\bsizes\s*=\s*["'](\d+)x\d+/i)?.[1] ?? '0');
        const svg = /\.svg(\?|$)/i.test(url) || /image\/svg/i.test(tag);
        const score = (rel.includes('apple-touch-icon') ? 1000 : 0) + (svg ? 500 : 0) + Math.min(size, 512);
        // Small favicons (under 64px, not SVG) look worse than the Google fallback, so skip them.
        if (score >= 64) found.push({ url, score });
    }
    return found.sort((a, b) => b.score - a.score).map((f) => f.url);
}

/* The company's logo: its website's own icon if it has a good one, else Google's favicon service. */
async function findLogo(domain: string): Promise<string | null> {
    const home = await fetchWithTimeout(`https://${domain}`, { headers: { Accept: 'text/html' } });
    const origin = home?.url ? new URL(home.url).origin : `https://${domain}`;
    const candidates: string[] = [];
    if (home?.ok && (home.headers.get('content-type') ?? '').includes('html')) {
        // Only the <head> matters; some sites put it after a lot of inlined markup.
        const html = (await home.text()).slice(0, 3_000_000);
        const head = html.slice(0, html.search(/<\/head>/i) + 1 || html.length);
        candidates.push(...iconCandidates(head, home.url || origin).slice(0, 3));
    }
    // The conventional location, used by sites that never link their icon.
    candidates.push(`${origin}/apple-touch-icon.png`);
    for (const url of candidates) {
        if (await isImage(url)) return url;
    }
    const google = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=256`;
    return (await isImage(google)) ? google : null;
}

/* Website (from the record, or asked to Tavily) and logo; never fails the whole auto-fill. */
async function websiteAndLogo(apiKey: string, subject: string, website: string) {
    try {
        let domain = website ? cleanDomain(website) : null;
        if (!domain) {
            const answer = await tavilyAnswer(apiKey, `What is the official website of ${subject}? Answer with the domain only, e.g. example.com.`);
            domain = cleanDomain(answer);
        }
        if (!domain) return { website: null, logo_url: null };
        return { website: `https://${domain}`, logo_url: await findLogo(domain) };
    } catch (err) {
        if (err instanceof Error && err.message === 'INVALID_KEY') throw err;
        return { website: null, logo_url: null };
    }
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

        const [description, industry, headquarters, founded, employee_count, found] =
            await Promise.all([
                tavilyAnswer(apiKey, `What does ${subject} do? Give a brief 2-3 sentence overview of its products and business.`, 'advanced'),
                tavilyAnswer(apiKey, `What industry or sector is ${subject} in? Answer in a few words.`),
                tavilyAnswer(apiKey, `Where is ${subject} headquartered? Answer with city and country only.`),
                tavilyAnswer(apiKey, `In what year was ${subject} founded? Answer with the year only.`),
                tavilyAnswer(apiKey, `Approximately how many employees does ${subject} have? Answer briefly, e.g. "about 5,000".`),
                websiteAndLogo(apiKey, subject, website),
            ]);

        return NextResponse.json({
            description,
            industry,
            headquarters,
            founded,
            employee_count,
            website: found.website,
            logo_url: found.logo_url,
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
