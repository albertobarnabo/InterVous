'use client';
// Read hooks. Every hook returns { data, error, loading, refreshing, refetch } and refetches
// on its own when the tab regains focus or a Realtime change arrives (see ./store).
import { db, fetchAll, likeLiteral, must } from './client';
import { todayIn } from './dates';
import { FIXTURE_MODE } from './env';
import { fixtureToday, loadFixture, type FixtureData } from './fixture';
import {
    DEFAULT_SETTINGS,
    JOB_EXTRA_COLUMNS,
    type Application,
    type Contact,
    type ContactLite,
    type InsightsApp,
    type JobExtraColumns,
    type Dossier,
    type InsightsInput,
    type JobAnswer,
    type JobDocument,
    type JobEvent,
    type JobEventLite,
    type JobOverview,
    type JobProofPoint,
    type JobProofPointWithPoint,
    type JobRequirement,
    type JobRow,
    type ProofPoint,
    type UserSettings,
} from './rows';
import { useResource, type ResourceResult } from './store';

const EVENT_LITE =
    'id,job_id,kind,direction,occurred_on,occurred_at,date_uncertain,from_phase,to_phase,title,source,created_at';

export const KEYS = {
    applications: 'applications',
    application: (ref: string) => `application:${ref}`,
    insights: 'insights',
    settings: 'settings',
} as const;

type Logo = { id: string; name: string; website: string | null; logo_url: string | null };

function byEventOrder(a: { occurred_on: string; id: number | string }, b: { occurred_on: string; id: number | string }) {
    return a.occurred_on < b.occurred_on ? -1 : a.occurred_on > b.occurred_on ? 1 : Number(a.id) - Number(b.id);
}

function groupEvents<E extends { job_id: number }>(events: E[]): Map<number, E[]> {
    const m = new Map<number, E[]>();
    for (const e of events) {
        const list = m.get(e.job_id);
        if (list) list.push(e);
        else m.set(e.job_id, [e]);
    }
    return m;
}

/** Logos only for the companies that appear in his jobs (by company_id, falling back to the name). */
async function companyLogos(apps: Pick<JobOverview, 'company_id' | 'company_name'>[]): Promise<Logo[]> {
    const ids = [...new Set(apps.map((a) => a.company_id).filter((x): x is string => !!x))];
    const names = [...new Set(apps.filter((a) => !a.company_id && a.company_name).map((a) => a.company_name as string))];
    const out: Logo[] = [];
    for (let i = 0; i < ids.length; i += 200) {
        out.push(...(must(await db.from('companies').select('id,name,website,logo_url').in('id', ids.slice(i, i + 200))) as Logo[]));
    }
    for (let i = 0; i < names.length; i += 100) {
        out.push(...(must(await db.from('companies').select('id,name,website,logo_url').in('name', names.slice(i, i + 100))) as Logo[]));
    }
    return out;
}

function logoLookup(companies: Logo[]) {
    const byId = new Map(companies.map((c) => [c.id, c]));
    const byName = new Map(companies.map((c) => [c.name.trim().toLowerCase(), c]));
    return (a: Pick<JobOverview, 'company_id' | 'company_name'>): Logo | null =>
        (a.company_id ? byId.get(a.company_id) : undefined) ?? byName.get(String(a.company_name ?? '').trim().toLowerCase()) ?? null;
}

function liteEvent(e: JobEvent): JobEventLite {
    const { id, job_id, kind, direction, occurred_on, occurred_at, date_uncertain, from_phase, to_phase, title, source, created_at } = e;
    return { id, job_id, kind, direction, occurred_on, occurred_at, date_uncertain, from_phase, to_phase, title, source, created_at };
}

// ── fetchers ────────────────────────────────────────────────────────────────

async function fetchApplications(): Promise<Application[]> {
    let apps: JobOverview[];
    let events: JobEventLite[];
    let logos: Logo[];
    if (FIXTURE_MODE) {
        const f = await loadFixture();
        apps = f.apps;
        events = f.events.map(liteEvent);
        logos = f.companies;
    } else {
        [apps, events] = await Promise.all([
            fetchAll<JobOverview>((a, b) => db.from('job_overview').select('*').order('id').range(a, b)),
            fetchAll<JobEventLite>((a, b) => db.from('job_events').select(EVENT_LITE).order('occurred_on').order('id').range(a, b)),
        ]);
        logos = await companyLogos(apps);
    }
    const logo = logoLookup(logos);
    const evs = groupEvents([...events].sort(byEventOrder));
    return apps.map((a) => ({ ...a, company_logo_url: logo(a)?.logo_url ?? null, events: evs.get(a.id as number) ?? [] }));
}

function fixtureDossier(f: FixtureData, ref: string): Dossier | null {
    const job = /^\d+$/.test(ref) ? f.jobs.find((j) => j.id === Number(ref)) : f.jobs.find((j) => j.slug === ref);
    if (!job) return null;
    const id = job.id;
    const ppById = new Map(f.proofPoints.map((p) => [p.id, p]));
    const company =
        f.companies.find((c) => c.id === job.company_id) ??
        f.companies.find((c) => c.name.trim().toLowerCase() === String(job.company_name).trim().toLowerCase()) ??
        null;
    return {
        job: { ...(f.apps.find((a) => a.id === id) as unknown as JobRow), ...job },
        overview: f.apps.find((a) => a.id === id) ?? null,
        company,
        events: f.events.filter((e) => e.job_id === id).sort(byEventOrder),
        documents: f.documents.filter((d) => d.job_id === id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
        answers: f.answers.filter((a) => a.job_id === id).sort((a, b) => a.position - b.position),
        requirements: f.requirements.filter((r) => r.job_id === id).sort((a, b) => a.position - b.position),
        proofPoints: f.jobProofPoints
            .filter((p) => p.job_id === id)
            .sort((a, b) => a.position - b.position)
            .map((p) => ({ ...p, proof_point: ppById.get(p.proof_point_id) ?? null })),
        contacts: f.contacts.filter((c) => c.job_id === id),
    };
}

async function fetchDossier(ref: string): Promise<Dossier | null> {
    if (FIXTURE_MODE) return fixtureDossier(await loadFixture(), ref);
    const isId = /^\d+$/.test(ref);
    const job = must(
        await db.from('jobs').select('*').eq(isId ? 'id' : 'slug', isId ? Number(ref) : ref).maybeSingle(),
    ) as JobRow | null;
    if (!job) return null;
    const id = job.id;
    const companyQuery = job.company_id
        ? db.from('companies').select('id,name,website,logo_url').eq('id', job.company_id).maybeSingle()
        : db.from('companies').select('id,name,website,logo_url').ilike('name', likeLiteral(String(job.company_name ?? '').trim())).limit(1).maybeSingle();
    const [overview, events, documents, answers, requirements, proofPoints, contacts, company] = await Promise.all([
        db.from('job_overview').select('*').eq('id', id).maybeSingle().then(must),
        db.from('job_events').select('*').eq('job_id', id).order('occurred_on').order('id').then(must),
        db.from('job_documents').select('*').eq('job_id', id).order('created_at', { ascending: false }).then(must),
        db.from('job_answers').select('*').eq('job_id', id).order('position').then(must),
        db.from('job_requirements').select('*').eq('job_id', id).order('position').then(must),
        db.from('job_proof_points').select('*, proof_point:proof_points(*)').eq('job_id', id).order('position').then(must),
        db.from('contacts').select('*').eq('job_id', id).order('created_at').then(must),
        companyQuery.then(must),
    ]);
    return {
        job,
        overview: overview as JobOverview | null,
        company: company as Logo | null,
        events: (events ?? []) as JobEvent[],
        documents: (documents ?? []) as JobDocument[],
        answers: (answers ?? []) as JobAnswer[],
        requirements: (requirements ?? []) as JobRequirement[],
        proofPoints: (proofPoints ?? []) as JobProofPointWithPoint[],
        contacts: (contacts ?? []) as Contact[],
    };
}

async function fetchSettingsRow(): Promise<UserSettings> {
    if (FIXTURE_MODE) return { ...(await loadFixture()).settings };
    const row = must(await db.from('user_settings').select('*').maybeSingle()) as UserSettings | null;
    return row ?? ({ user_id: '', updated_at: new Date(0).toISOString(), ...DEFAULT_SETTINGS } as UserSettings);
}

/** Merge the extra `jobs` columns into overview rows; the overview row wins where both have a column. */
function withExtras(apps: JobOverview[], jobs: Array<Partial<JobExtraColumns> & { id: number | null }>): InsightsApp[] {
    const byId = new Map(jobs.map((j) => [Number(j.id), j]));
    return apps.map((a) => {
        const x = byId.get(Number(a.id));
        if (!x) return a;
        const fill: Partial<JobExtraColumns> = {};
        for (const k of JOB_EXTRA_COLUMNS) if (!(k in a) && k in x) (fill as Record<string, unknown>)[k] = x[k];
        return { ...fill, ...a };
    });
}

const liteContact = (c: Contact): ContactLite => ({ id: c.id, job_id: c.job_id, company_id: c.company_id ?? null, name: c.name });

async function fetchInsightsInput(): Promise<InsightsInput> {
    if (FIXTURE_MODE) {
        const f = await loadFixture();
        return {
            apps: withExtras([...f.apps], f.jobs),
            events: [...f.events].sort(byEventOrder),
            requirements: [...f.requirements],
            jobProofPoints: [...f.jobProofPoints],
            proofPoints: [...f.proofPoints],
            contacts: f.contacts.map(liteContact),
            settings: { ...f.settings },
            today: fixtureToday(f),
        };
    }
    const [apps, jobs, events, requirements, jobProofPoints, proofPoints, contacts, settings] = await Promise.all([
        fetchAll<JobOverview>((a, b) => db.from('job_overview').select('*').order('id').range(a, b)),
        fetchAll<Partial<JobExtraColumns> & { id: number }>((a, b) =>
            db.from('jobs').select(['id', ...JOB_EXTRA_COLUMNS].join(',')).order('id').range(a, b),
        ),
        fetchAll<JobEvent>((a, b) => db.from('job_events').select('*').order('occurred_on').order('id').range(a, b)),
        fetchAll<JobRequirement>((a, b) => db.from('job_requirements').select('*').order('job_id').order('position').range(a, b)),
        fetchAll<JobProofPoint>((a, b) => db.from('job_proof_points').select('*').order('job_id').order('position').range(a, b)),
        fetchAll<ProofPoint>((a, b) => db.from('proof_points').select('*').order('key').range(a, b)),
        fetchAll<ContactLite>((a, b) => db.from('contacts').select('id,job_id,company_id,name').order('created_at').order('id').range(a, b)),
        fetchSettingsRow(),
    ]);
    return {
        apps: withExtras(apps, jobs),
        events,
        requirements,
        jobProofPoints,
        proofPoints,
        contacts,
        settings,
        today: todayIn(settings.timezone),
    };
}

// ── hooks ───────────────────────────────────────────────────────────────────

/** Every application (job_overview rows) with company logo and events, ordered by id. */
export function useApplications(): ResourceResult<Application[]> {
    return useResource(KEYS.applications, fetchApplications);
}

/**
 * One application by slug, or by numeric id for legacy rows. `data` is null when it does not exist
 * (or belongs to someone else). Pass null to skip.
 */
export function useApplication(ref: string | null | undefined): ResourceResult<Dossier | null> {
    const r = ref ? decodeURIComponent(ref) : null;
    return useResource(r ? KEYS.application(r) : null, () => fetchDossier(r as string));
}

/**
 * The complete input for lib/core/today.mjs and lib/core/insights.mjs:
 * {apps (job_overview + salary_*, posting_checked_at, work_mode, channel_detail), events, requirements,
 * jobProofPoints, proofPoints, contacts, settings, today}.
 */
export function useInsightsInput(): ResourceResult<InsightsInput> {
    return useResource(KEYS.insights, fetchInsightsInput);
}

/** The user_settings row, or the defaults (14/45/21/7, Europe/Berlin, 2026-08-01) when none is saved. */
export function useSettings(): ResourceResult<UserSettings> {
    return useResource(KEYS.settings, fetchSettingsRow);
}
