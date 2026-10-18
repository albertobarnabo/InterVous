/** The 9 phases (docs/SPEC.md 4.2). `phase` is the source of truth; status/stage are legacy mirrors. */
export type Phase =
    | 'draft'
    | 'applied'
    | 'screening'
    | 'interviewing'
    | 'offer'
    | 'rejected'
    | 'no_reply'
    | 'withdrawn'
    | 'skipped';

export const PHASES: readonly Phase[] = [
    'draft', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'no_reply', 'withdrawn', 'skipped',
] as const;

export type WorkMode = 'onsite' | 'hybrid' | 'remote';
export type Channel = 'ats' | 'portal' | 'referral' | 'recruiter' | 'linkedin' | 'email' | 'other';
export type SalaryPeriod = 'year' | 'month' | 'day' | 'hour';
export type RowSource = 'web' | 'cli' | 'import';

/**
 * One application (a `jobs` row). The first block is the legacy shape the old UI writes;
 * the v2 columns are optional so legacy code that builds a JobEntry by hand keeps compiling.
 * Rows read from the database always carry them (nullable).
 */
export type JobEntry = {
    id: number;
    company_name: string;
    role: string;
    location: string;
    application_date: string | null;
    status: string;
    stage: string;
    user_id: string;
    url: string;

    // v2 (migration 20261017120000_intervous_v2.sql)
    phase?: Phase | null;
    slug?: string | null;
    company_id?: string | null;
    team?: string | null;
    work_mode?: WorkMode | null;
    country_code?: string | null;
    channel?: Channel | null;
    channel_detail?: string | null;
    role_family?: string | null;
    seniority?: string | null;
    years_required?: number | null;
    visa_needed?: boolean | null;
    salary_text?: string | null;
    salary_min?: number | null;
    salary_max?: number | null;
    salary_currency?: string | null;
    salary_period?: SalaryPeriod | null;
    applied_on?: string | null;
    cv_built_on?: string | null;
    closes_on?: string | null;
    posting_live?: boolean | null;
    posting_checked_at?: string | null;
    next_action?: string | null;
    next_action_due?: string | null;
    cv_variant?: string | null;
    notes?: string | null;
    status_evidence?: string | null;
    uncertain?: string[];
    source?: RowSource;
    last_activity_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

export type ApiKeys = {
    user_id: string;
    open_ai: string;
    deep_seek: string;
    mistral: string;
    tavily: string;
}

export type CompanyInfo = {
    company_id: string;
    description: string | null;
    industry: string | null;
    headquarters: string | null;
    founded: string | null;
    employee_count: string | null;
    updated_at?: string;
    updated_by?: string | null;
};

export type Company = {
    id: string;
    name: string;
    website: string | null;
    logo_url: string | null;
    created_by: string;
};

export type CompanyTag = {
    id: string;
    name: string;
    description: string | null;
};

export type CompanyTagMap = {
    company_id: string;
    tag_id: string;
    created_by: string;
};

export type CompanyWithTags = Company & {
    tags: CompanyTag[];
    job_count?: number;
};

export type SortOption = 'name_asc' | 'name_desc' | 'recent' | 'shuffle';