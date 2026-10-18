// Row types for the v2 schema, taken from lib/database.types.ts (hand-written by WP1 from
// supabase/migrations/20261017120000_intervous_v2.sql), plus the shapes lib/data returns.
import type { Database, EventDirection, EventKind } from '../database.types';
import type { Company, Phase } from '../types';

type Tables = Database['public']['Tables'];
type Views = Database['public']['Views'];

export type JobRow = Tables['jobs']['Row'];
export type JobUpdate = Tables['jobs']['Update'];
export type JobOverview = Views['job_overview']['Row'];
export type JobEvent = Tables['job_events']['Row'];
export type JobDocument = Tables['job_documents']['Row'];
export type JobAnswer = Tables['job_answers']['Row'];
export type JobRequirement = Tables['job_requirements']['Row'];
export type ProofPoint = Tables['proof_points']['Row'];
export type JobProofPoint = Tables['job_proof_points']['Row'];
export type Contact = Tables['contacts']['Row'];
export type UserSettings = Tables['user_settings']['Row'];

export type {
    EventKind,
    EventDirection,
    EventSource,
    RequirementVerdict as Verdict,
    GapState,
    MetricStatus,
    DocumentKind,
    JobPhase,
    UpsertApplicationResult,
} from '../database.types';

/** The event columns the list and board need (no body). */
export type JobEventLite = Pick<
    JobEvent,
    'id' | 'job_id' | 'kind' | 'direction' | 'occurred_on' | 'occurred_at' | 'date_uncertain' | 'from_phase' | 'to_phase' | 'title' | 'source' | 'created_at'
>;

/** A row of useApplications(): the job_overview row, its company logo and its events (oldest first). */
export type Application = JobOverview & {
    company_logo_url: string | null;
    events: JobEventLite[];
};

/** A job_proof_points row with its proof point. */
export type JobProofPointWithPoint = JobProofPoint & { proof_point: ProofPoint | null };

/** Everything the dossier page shows for one application. */
export type Dossier = {
    job: JobRow;
    overview: JobOverview | null;
    company: Pick<Company, 'id' | 'name' | 'website' | 'logo_url'> | null;
    /** Oldest first, so the story reads downward. */
    events: JobEvent[];
    /** Newest first. */
    documents: JobDocument[];
    answers: JobAnswer[];
    requirements: JobRequirement[];
    proofPoints: JobProofPointWithPoint[];
    contacts: Contact[];
};

/** `jobs` columns that job_overview leaves out but lib/core reads (I10 salaries, Today item 8 evidence, facts). */
export const JOB_EXTRA_COLUMNS = [
    'salary_text',
    'salary_min',
    'salary_max',
    'salary_currency',
    'salary_period',
    'posting_checked_at',
    'work_mode',
    'channel_detail',
] as const;
export type JobExtraColumns = Pick<JobRow, (typeof JOB_EXTRA_COLUMNS)[number]>;

/** A job_overview row with the extra `jobs` columns merged in (the overview row wins where both have one). */
export type InsightsApp = JobOverview & Partial<JobExtraColumns>;

/** The contact columns Today's follow-up rule needs ("a contact exists", 5.3 item 5). */
export type ContactLite = Pick<Contact, 'id' | 'job_id' | 'company_id' | 'name'>;

/**
 * The input of lib/core/today.mjs and lib/core/insights.mjs (docs/SPEC.md section 5), complete:
 * it can be passed to buildToday / computeInsights as it is.
 */
export type InsightsInput = {
    apps: InsightsApp[];
    events: JobEvent[];
    requirements: JobRequirement[];
    jobProofPoints: JobProofPoint[];
    proofPoints: ProofPoint[];
    contacts: ContactLite[];
    settings: UserSettings;
    /** 'YYYY-MM-DD' in settings.timezone (or the fixture's pinned date). */
    today: string;
};

/** New-event input for logEvent(). Only `kind` is required; the database infers to_phase and direction. */
export type NewEvent = {
    kind: EventKind;
    occurred_on?: string;
    occurred_at?: string | null;
    date_uncertain?: boolean;
    direction?: EventDirection | null;
    to_phase?: Phase | null;
    title?: string | null;
    body?: string | null;
    contact_id?: string | null;
};

export const DEFAULT_SETTINGS: Omit<UserSettings, 'user_id' | 'updated_at'> = {
    follow_up_after_days: 14,
    no_reply_after_days: 45,
    mature_after_days: 21,
    draft_stale_after_days: 7,
    weekly_target: 3,
    timezone: 'Europe/Berlin',
    campaign_start: '2026-08-01',
};
