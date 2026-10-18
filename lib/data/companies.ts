'use client';
// Companies as the application page and /companies use them:
//   searchCompanies(query)            company options for a picker (logo, name, website)
//   linkCompany(jobId, companyId)     set jobs.company_id (and the record's spelling of the name); null unlinks
//   setCompanyLogo(companyId, src)    a File goes to the public bucket user_avatars at
//                                     <user_id>/company-logos/<company_id>.<ext>; a string is a pasted image URL.
//                                     Either way companies.logo_url is saved.
//   removeCompanyLogo(companyId)      clears companies.logo_url (and removes an uploaded file)
// Dev fixture mode works on the in-memory fixture, whose company list has a record for every
// company name its applications use (lib/data/fixture.ts).
import { currentUserId, db, likeLiteral, must, toError } from './client';
import { FIXTURE_MODE } from './env';
import { deriveOverview, loadFixture, type FixtureCompany, type FixtureData } from './fixture';
import { updateApplication } from './mutations';
import { KEYS } from './queries';
import type { Application, JobRow } from './rows';
import { invalidateAll, patchCached } from './store';

export type CompanyOption = { id: string; name: string; website: string | null; logo_url: string | null };

const LOGO_BUCKET = 'user_avatars';
/** Largest logo file accepted for upload. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
/** Raster types only: an uploaded SVG could carry script when opened directly from the public bucket. */
export const LOGO_TYPES: Readonly<Record<string, string>> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase();

// ── fixture ─────────────────────────────────────────────────────────────────

/** The fixture's companies (loadFixture already added one for every company name its applications use). */
export function fixtureCompanies(f: FixtureData): FixtureCompany[] {
    return f.companies;
}

/** Exact name first, then names that start with the query, then the rest (each A to Z). */
function rank(list: CompanyOption[], query: string): CompanyOption[] {
    const q = norm(query);
    const score = (c: CompanyOption) => (norm(c.name) === q ? 0 : norm(c.name).startsWith(q) ? 1 : 2);
    return [...list].sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

// ── reads ───────────────────────────────────────────────────────────────────

/** Companies whose name contains `query` (all of them, A to Z, when it is empty), best matches first. */
export async function searchCompanies(query: string, limit = 8): Promise<CompanyOption[]> {
    const q = query.trim();
    if (FIXTURE_MODE) {
        const list = fixtureCompanies(await loadFixture())
            .filter((c) => !q || norm(c.name).includes(norm(q)))
            .map((c) => ({ id: c.id, name: c.name, website: c.website, logo_url: c.logo_url }));
        return rank(list, q).slice(0, limit);
    }
    let req = db.from('companies').select('id,name,website,logo_url');
    if (q) req = req.ilike('name', `%${likeLiteral(q)}%`);
    // Ask for more than `limit` so an exact match is not cut off by the A-Z order.
    const rows = must(await req.order('name').limit(q ? Math.max(limit * 4, 40) : limit)) as CompanyOption[] | null;
    return rank(rows ?? [], q).slice(0, limit);
}

/** One company by id, or null. */
export async function getCompanyOption(companyId: string): Promise<CompanyOption | null> {
    if (FIXTURE_MODE) {
        const c = fixtureCompanies(await loadFixture()).find((x) => x.id === companyId);
        return c ? { id: c.id, name: c.name, website: c.website, logo_url: c.logo_url } : null;
    }
    return must(await db.from('companies').select('id,name,website,logo_url').eq('id', companyId).maybeSingle()) as CompanyOption | null;
}

// ── link an application to a company ────────────────────────────────────────

/**
 * Link an application to a company: sets jobs.company_id and renames jobs.company_name to the
 * record's spelling, so lists, counts and logos agree. `null` unlinks (the name stays as written).
 */
export async function linkCompany(jobId: number, companyId: string | null): Promise<JobRow> {
    if (!companyId) return updateApplication(jobId, { company_id: null });
    const company = await getCompanyOption(companyId);
    if (!company) throw new Error('That company no longer exists. Pick another one.');
    if (FIXTURE_MODE) {
        const f = await loadFixture();
        const job = f.jobs.find((j) => j.id === jobId);
        if (!job) throw new Error('No application was updated. It may have been deleted.');
        Object.assign(job, { company_id: company.id, company_name: company.name, updated_at: new Date().toISOString() });
        deriveOverview(f, jobId);
        patchCached<Application[]>(KEYS.applications, (rows) =>
            rows.map((r) => (r.id === jobId ? { ...r, company_id: company.id, company_name: company.name, company_logo_url: company.logo_url } : r)),
        );
        await invalidateAll();
        return { ...job };
    }
    const row = await updateApplication(jobId, { company_id: company.id, company_name: company.name });
    patchCached<Application[]>(KEYS.applications, (rows) => rows.map((r) => (r.id === jobId ? { ...r, company_logo_url: company.logo_url } : r)));
    return row;
}

// ── logos ───────────────────────────────────────────────────────────────────

/** The text of the error for a file that cannot be a logo, or null when it can. */
export function logoFileProblem(file: File): string | null {
    if (!LOGO_TYPES[file.type]) return 'Choose a PNG, JPEG, WebP or GIF image.';
    if (file.size > LOGO_MAX_BYTES) return 'That image is over 2 MB. Choose a smaller one.';
    return null;
}

/** A pasted image link, checked: http(s) only. Throws a readable error otherwise. */
export function checkLogoUrl(raw: string): string {
    const t = raw.trim();
    let u: URL;
    try {
        u = new URL(t);
    } catch {
        throw new Error('Paste the full image link, starting with https://');
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Paste the full image link, starting with https://');
    return u.toString();
}

/** Show the new logo on every cached application of this company at once. */
function patchLogo(company: { id: string; name: string }, url: string | null) {
    patchCached<Application[]>(KEYS.applications, (rows) =>
        rows.map((r) =>
            r.company_id === company.id || (!r.company_id && norm(r.company_name) === norm(company.name)) ? { ...r, company_logo_url: url } : r,
        ),
    );
}

/** The storage path inside user_avatars when `url` is one of our uploaded company logos. */
function uploadedPath(url: string | null | undefined, uid: string, companyId: string): string | null {
    if (!url) return null;
    try {
        const parts = new URL(url).pathname.split(`/${LOGO_BUCKET}/`);
        const path = parts.length > 1 ? decodeURIComponent(parts[1]) : '';
        return path.startsWith(`${uid}/company-logos/${companyId}.`) ? path : null;
    } catch {
        return null;
    }
}

async function saveLogoUrl(companyId: string, url: string | null): Promise<{ id: string; name: string }> {
    if (FIXTURE_MODE) {
        const c = fixtureCompanies(await loadFixture()).find((x) => x.id === companyId);
        if (!c) throw new Error('That company no longer exists.');
        c.logo_url = url;
        return c;
    }
    const rows = must(await db.from('companies').update({ logo_url: url }).eq('id', companyId).select('id,name')) as
        | { id: string; name: string }[]
        | null;
    if (!rows?.length) throw new Error('The logo was not saved. The company may have been deleted, or you may not have access to it.');
    return rows[0];
}

/**
 * Set a company's logo. A File is uploaded to the public bucket user_avatars at
 * <user_id>/company-logos/<company_id>.<ext> (replacing an earlier upload); a string is a pasted
 * image URL. Saves companies.logo_url and returns it.
 */
export async function setCompanyLogo(companyId: string, source: File | string): Promise<string> {
    try {
        if (typeof source === 'string') {
            const url = checkLogoUrl(source);
            patchLogo(await saveLogoUrl(companyId, url), url);
            return url;
        }
        const problem = logoFileProblem(source);
        if (problem) throw new Error(problem);
        if (FIXTURE_MODE) {
            // No storage in fixture mode: a local object URL stands in until the page reloads.
            const url = URL.createObjectURL(source);
            patchLogo(await saveLogoUrl(companyId, url), url);
            return url;
        }
        const uid = await currentUserId();
        if (!uid) throw new Error('You are signed out. Sign in again to add a logo.');
        const before = (must(await db.from('companies').select('logo_url').eq('id', companyId).maybeSingle()) as { logo_url: string | null } | null)
            ?.logo_url;
        const path = `${uid}/company-logos/${companyId}.${LOGO_TYPES[source.type]}`;
        const up = await db.storage.from(LOGO_BUCKET).upload(path, source, { upsert: true, contentType: source.type, cacheControl: '3600' });
        if (up.error) throw toError(up.error, 'The image was not uploaded. Try again.');
        // The path is the same on every upload of this company, so a version stamp busts caches.
        const url = `${db.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
        patchLogo(await saveLogoUrl(companyId, url), url);
        const old = uploadedPath(before, uid, companyId);
        if (old && old !== path) await db.storage.from(LOGO_BUCKET).remove([old]).catch(() => undefined);
        return url;
    } finally {
        void invalidateAll();
    }
}

/** Remove a company's logo (initials show again). An uploaded file is deleted too. */
export async function removeCompanyLogo(companyId: string): Promise<void> {
    try {
        let before: string | null = null;
        if (!FIXTURE_MODE) {
            before = (must(await db.from('companies').select('logo_url').eq('id', companyId).maybeSingle()) as { logo_url: string | null } | null)
                ?.logo_url ?? null;
        }
        patchLogo(await saveLogoUrl(companyId, null), null);
        if (!FIXTURE_MODE) {
            const uid = await currentUserId();
            const old = uid ? uploadedPath(before, uid, companyId) : null;
            if (old) await db.storage.from(LOGO_BUCKET).remove([old]).catch(() => undefined);
        }
    } finally {
        void invalidateAll();
    }
}
