'use client';
// Dev-only fixture mode (NEXT_PUBLIC_FIXTURES=1 and NODE_ENV=development).
// The fixture JSON is served by src/app/dev/fixture/route.ts from lib/core/test/fixture.json
// (written by WP2 / `intervous import --emit-fixture`), never bundled. Writes change an in-memory
// copy and imitate the database triggers closely enough to exercise the screens; a reload resets it.
import { appUrl } from '../api';
import type { Phase } from '../types';
import { todayIn } from './dates';
import {
    DEFAULT_SETTINGS,
    type Contact,
    type JobAnswer,
    type JobDocument,
    type JobEvent,
    type JobOverview,
    type JobProofPoint,
    type JobRequirement,
    type JobRow,
    type ProofPoint,
    type UserSettings,
} from './rows';

export type FixtureCompany = { id: string; name: string; website: string | null; logo_url: string | null };

export type FixtureData = {
    apps: JobOverview[];
    jobs: JobRow[];
    events: JobEvent[];
    documents: JobDocument[];
    answers: JobAnswer[];
    requirements: JobRequirement[];
    jobProofPoints: JobProofPoint[];
    proofPoints: ProofPoint[];
    contacts: Contact[];
    companies: FixtureCompany[];
    settings: UserSettings;
    today: string | null;
    /** True when the route had no fixture file and served its placeholder. */
    placeholder: boolean;
};

type Raw = Record<string, unknown>;
const arr = <T>(raw: Raw, ...keys: string[]): T[] => {
    for (const k of keys) if (Array.isArray(raw[k])) return raw[k] as T[];
    return [];
};

function normalize(raw: Raw): FixtureData {
    let apps = arr<JobOverview>(raw, 'apps', 'overview', 'job_overview');
    let jobs = arr<JobRow>(raw, 'jobs');
    if (!jobs.length) jobs = apps.map((a) => ({ ...(a as unknown as JobRow) }));
    if (!apps.length) apps = jobs.map((j) => ({ ...(j as unknown as JobOverview) }));
    const s = (Array.isArray(raw.settings) ? raw.settings[0] : raw.settings ?? raw.user_settings) as Partial<UserSettings> | undefined;
    const data: FixtureData = {
        apps,
        jobs,
        events: arr<JobEvent>(raw, 'events', 'job_events'),
        documents: arr<JobDocument>(raw, 'documents', 'job_documents'),
        answers: arr<JobAnswer>(raw, 'answers', 'job_answers'),
        requirements: arr<JobRequirement>(raw, 'requirements', 'job_requirements', 'fit'),
        jobProofPoints: arr<JobProofPoint>(raw, 'jobProofPoints', 'job_proof_points'),
        proofPoints: arr<ProofPoint>(raw, 'proofPoints', 'proof_points'),
        contacts: arr<Contact>(raw, 'contacts'),
        companies: arr<FixtureCompany>(raw, 'companies'),
        settings: { user_id: 'fixture-user', updated_at: new Date(0).toISOString(), ...DEFAULT_SETTINGS, ...(s ?? {}) } as UserSettings,
        today: typeof raw.today === 'string' ? raw.today : null,
        placeholder: raw.placeholder === true,
    };
    return data;
}

let loading: Promise<FixtureData> | null = null;

export function loadFixture(): Promise<FixtureData> {
    if (!loading) {
        loading = fetch(appUrl('dev/fixture'), { cache: 'no-store' })
            .then((r) => {
                if (!r.ok) throw new Error(`Fixture route returned ${r.status}`);
                return r.json() as Promise<Raw>;
            })
            .then((raw) => {
                const data = normalize(raw);
                if (data.placeholder) {
                    console.warn('[intervous] fixture mode: lib/core/test/fixture.json is missing; showing the built-in placeholder.');
                }
                return data;
            })
            .catch((e) => {
                loading = null;
                throw e;
            });
    }
    return loading;
}

export function fixtureToday(f: FixtureData): string {
    return f.today ?? todayIn(f.settings.timezone);
}

// ── trigger imitation (docs/SPEC.md 4.3 sections 2 and 5) ───────────────────

const IMPLIED: Record<string, (cur: string | null) => Phase | null> = {
    applied: (c) => (c === null || c === 'draft' || c === 'skipped' ? 'applied' : null),
    reply: (c) => (c === 'applied' ? 'screening' : null),
    assessment: (c) => (c === 'applied' || c === 'screening' ? 'screening' : null),
    interview_scheduled: (c) => (c === 'applied' || c === 'screening' ? 'interviewing' : null),
    rejection: () => 'rejected',
    offer: () => 'offer',
    withdrawn: () => 'withdrawn',
    skipped: () => 'skipped',
};
const IN_KINDS = ['auto_ack', 'reply', 'assessment', 'interview_scheduled', 'rejection', 'offer'];
const OUT_KINDS = ['applied', 'follow_up_sent', 'withdrawn'];

export function impliedPhase(kind: string, current: string | null): Phase | null {
    return IMPLIED[kind]?.(current) ?? null;
}
export function defaultDirection(kind: string): 'in' | 'out' | 'self' {
    return IN_KINDS.includes(kind) ? 'in' : OUT_KINDS.includes(kind) ? 'out' : 'self';
}

/** Recompute the job_overview columns that come from child rows, for one job. */
export function deriveOverview(f: FixtureData, jobId: number): void {
    const i = f.apps.findIndex((a) => a.id === jobId);
    const job = f.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const today = fixtureToday(f);
    const ev = f.events.filter((e) => e.job_id === jobId);
    const inbound = ev.filter((e) => e.direction === 'in' && e.kind !== 'auto_ack');
    const dates = (xs: JobEvent[]) => xs.map((e) => e.occurred_on).sort();
    const min = (xs: string[]) => xs[0] ?? null;
    const max = (xs: string[]) => xs[xs.length - 1] ?? null;
    const req = f.requirements.filter((r) => r.job_id === jobId);
    const ans = f.answers.filter((a) => a.job_id === jobId);
    const docs = f.documents.filter((d) => d.job_id === jobId);
    const interviews = ev
        .filter((e) => e.kind === 'interview_scheduled')
        .map((e) => e.occurred_at ?? `${e.occurred_on}T00:00:00Z`)
        .filter((t) => t.slice(0, 10) >= today)
        .sort();
    const base = (i >= 0 ? f.apps[i] : {}) as JobOverview;
    const next = {
        ...base,
        ...pickOverview(job),
        first_response_on: min(dates(inbound)),
        last_inbound_on: max(dates(inbound.filter((e) => e.occurred_on <= today))),
        last_follow_up_on: max(dates(ev.filter((e) => e.kind === 'follow_up_sent'))),
        last_event_on: max(dates(ev.filter((e) => e.kind !== 'phase_change' && e.occurred_on <= today))),
        next_interview_at: interviews[0] ?? null,
        open_gaps: req.filter((r) => r.verdict === 'gap' && (r.gap_state ?? 'open') !== 'no_longer_true').length,
        cautions: req.filter((r) => r.verdict === 'caution').length,
        answer_count: ans.length,
        unsaved_answers: ans.filter((a) => a.answer === null).length,
        has_cv: docs.some((d) => d.kind === 'cv_pdf'),
        has_sent_cv: docs.some((d) => d.kind === 'cv_pdf' && d.submitted === true),
        has_jd: docs.some((d) => d.kind === 'jd_snapshot'),
    } as JobOverview;
    if (i >= 0) f.apps[i] = next;
    else f.apps.push(next);
}

const OVERVIEW_JOB_COLUMNS = [
    'id', 'slug', 'user_id', 'company_name', 'company_id', 'role', 'location', 'country_code', 'url', 'phase', 'stage',
    'channel', 'role_family', 'visa_needed', 'years_required', 'applied_on', 'cv_built_on', 'closes_on', 'next_action',
    'next_action_due', 'posting_live', 'uncertain', 'last_activity_at', 'created_at', 'updated_at', 'source',
] as const;

function pickOverview(job: JobRow): Partial<JobOverview> {
    const out: Record<string, unknown> = {};
    for (const k of OVERVIEW_JOB_COLUMNS) if (k in job) out[k] = (job as Record<string, unknown>)[k];
    return out as Partial<JobOverview>;
}

/** Insert an event the way the database would (to_phase, direction, phase move, applied_on). */
export function fixtureInsertEvent(f: FixtureData, ev: Partial<JobEvent> & { job_id: number; kind: string }): JobEvent {
    const job = f.jobs.find((j) => j.id === ev.job_id);
    if (!job) throw new Error(`job ${ev.job_id} not found`);
    const cur = (job.phase as string | null) ?? null;
    const id = f.events.reduce((m, e) => Math.max(m, Number(e.id)), 0) + 1;
    const today = fixtureToday(f);
    let to = (ev.to_phase as Phase | null | undefined) ?? null;
    if (!to && ev.kind !== 'phase_change') to = impliedPhase(ev.kind, cur);
    const row = {
        id,
        user_id: job.user_id,
        occurred_on: today,
        occurred_at: null,
        date_uncertain: false,
        title: null,
        body: null,
        contact_id: null,
        source: 'web',
        created_at: new Date().toISOString(),
        ...ev,
        to_phase: to,
        from_phase: ev.from_phase ?? (to ? cur : null),
        direction: ev.direction ?? defaultDirection(ev.kind),
    } as JobEvent;
    f.events.push(row);
    const newer = f.events.some((e) => e.job_id === row.job_id && e.id !== row.id && e.to_phase && e.occurred_on > row.occurred_on);
    if (to && !newer) job.phase = to as JobRow['phase'];
    if (row.kind === 'applied' && !job.applied_on) job.applied_on = row.occurred_on;
    job.updated_at = new Date().toISOString();
    deriveOverview(f, row.job_id);
    return row;
}
