// Types for lib/core (plain ESM + JSDoc). Import from '<path>/lib/core' in Next/TypeScript;
// Node and the CLI import '<path>/lib/core/index.mjs' (index.d.mts re-exports these types).
// Dates are 'YYYY-MM-DD' strings; timestamps are ISO strings, as Supabase returns them.

// ===========================================================================
// Value types
// ===========================================================================

export type DateString = string;
export type Timestamp = string;

export type Phase = 'draft' | 'applied' | 'screening' | 'interviewing' | 'offer' | 'rejected' | 'no_reply' | 'withdrawn' | 'skipped';
export type EventKind =
  | 'cv_built' | 'applied' | 'auto_ack' | 'reply' | 'assessment' | 'interview_scheduled' | 'interview_done'
  | 'follow_up_sent' | 'rejection' | 'offer' | 'withdrawn' | 'skipped' | 'posting_closed' | 'phase_change' | 'note';
export type Direction = 'in' | 'out' | 'self';
export type Verdict = 'met' | 'partial' | 'gap' | 'caution';
export type GapState = 'open' | 'worded_around' | 'not_claimed' | 'no_longer_true';
export type MetricStatus = 'verified' | 'needs_care' | 'unverified';
export type Channel = 'ats' | 'portal' | 'referral' | 'recruiter' | 'linkedin' | 'email' | 'other';
export type WorkMode = 'onsite' | 'hybrid' | 'remote';
export type Source = 'web' | 'cli' | 'import';
export type SalaryPeriod = 'year' | 'month' | 'day' | 'hour';
export type DocumentKind = 'cv_pdf' | 'cv_source' | 'jd_snapshot' | 'cover_letter' | 'other';
export type ListGroupId = 'interviews' | 'waiting' | 'not_sent' | 'closed' | 'older';
export type BoardColumnId = 'draft' | 'applied' | 'screening' | 'interviewing' | 'offer' | 'closed';
/** What the sample-size rule allows for a denominator (stats.mjs). */
export type Display = 'counts' | 'range' | 'percent';
/** Dot state. `unconfirmed` is carried as a separate boolean on each dot (draw it hollow). */
export type DotState = 'yes' | 'no' | 'waiting' | 'recent';

// ===========================================================================
// Input rows (spec 4.3)
// ===========================================================================

/** A job_overview row. Optional jobs columns (salary_*, work_mode, ...) may be merged in. */
export interface JobOverviewRow {
  id: number;
  slug: string | null;
  user_id?: string;
  company_name: string;
  company_id?: string | null;
  role: string;
  location?: string | null;
  country_code?: string | null;
  url?: string | null;
  phase: Phase;
  stage?: string | null;
  channel?: Channel | null;
  role_family?: string | null;
  visa_needed?: boolean | null;
  years_required?: number | null;
  applied_on: DateString | null;
  cv_built_on?: DateString | null;
  closes_on?: DateString | null;
  next_action?: string | null;
  next_action_due?: DateString | null;
  posting_live?: boolean | null;
  uncertain?: string[] | null;
  last_activity_at?: Timestamp | null;
  created_at?: Timestamp | null;
  updated_at?: Timestamp | null;
  source?: Source;
  // computed by the view
  first_response_on?: DateString | null;
  last_inbound_on?: DateString | null;
  last_follow_up_on?: DateString | null;
  last_event_on?: DateString | null;
  next_interview_at?: Timestamp | null;
  open_gaps?: number;
  cautions?: number;
  answer_count?: number;
  unsaved_answers?: number;
  has_cv?: boolean;
  has_sent_cv?: boolean;
  has_jd?: boolean;
  // jobs columns that are NOT in job_overview; merge them in where needed (I10 needs salary_*)
  posting_checked_at?: Timestamp | null;
  work_mode?: WorkMode | null;
  channel_detail?: string | null;
  salary_text?: string | null;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  salary_currency?: string | null;
  salary_period?: SalaryPeriod | null;
}

export interface JobEvent {
  id?: number;
  job_id: number;
  user_id?: string;
  kind: EventKind;
  direction?: Direction | null;
  occurred_on: DateString;
  occurred_at?: Timestamp | null;
  date_uncertain?: boolean;
  from_phase?: Phase | null;
  to_phase?: Phase | null;
  title?: string | null;
  body?: string | null;
  contact_id?: string | null;
  source?: Source | 'auto';
  created_at?: Timestamp;
}

export interface JobRequirement {
  id?: string;
  job_id: number;
  user_id?: string;
  position?: number;
  requirement: string;
  importance?: 'required' | 'nice' | null;
  verdict: Verdict;
  evidence?: string | null;
  topic?: string | null;
  gap_state?: GapState | null;
  anchor_text?: string | null;
  note?: string | null;
  created_at?: Timestamp;
}

export interface ProofPoint {
  id: string;
  user_id?: string;
  key: string;
  name: string;
  summary?: string | null;
  metric?: string | null;
  facts?: Record<string, string | number | boolean | null>;
  aliases?: string[];
  metric_status?: MetricStatus;
  caveat?: string | null;
  link?: string | null;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface JobProofPoint {
  job_id: number;
  proof_point_id: string;
  user_id?: string;
  position?: number;
  detail?: string | null;
}

export interface Contact {
  id?: string;
  job_id: number | null;
  company_id?: string | null;
  name: string;
  role?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  notes?: string | null;
}

export interface UserSettings {
  follow_up_after_days: number;
  no_reply_after_days: number;
  mature_after_days: number;
  draft_stale_after_days: number;
  weekly_target: number;
  timezone: string;
  campaign_start: DateString;
}

/** The one input shape of buildToday / computeInsights (spec 5). */
export interface CoreInput {
  apps: JobOverviewRow[];
  /** All job_events of these apps. Omit to rely on the view's computed columns only. */
  events?: JobEvent[];
  requirements?: JobRequirement[];
  jobProofPoints?: JobProofPoint[];
  proofPoints?: ProofPoint[];
  /** Needed by Today's follow-up rule ("a contact exists"). */
  contacts?: Contact[];
  settings?: Partial<UserSettings> | null;
  /** 'YYYY-MM-DD'. Defaults to today in settings.timezone. */
  today?: DateString;
}

// ===========================================================================
// dates.mjs
// ===========================================================================

export const DEFAULT_TIMEZONE: 'Europe/Berlin';
export function isDateString(value: unknown): boolean;
/** 'YYYY-MM-DD' as is; a timestamp or Date converted to the date in `timeZone` (UTC if omitted). */
export function toDateOnly(value: string | Date | null | undefined, timeZone?: string): DateString | null;
export function todayIn(timeZone?: string, now?: Date): DateString;
export function toDayNumber(value: string | Date | null | undefined, timeZone?: string): number | null;
export function fromDayNumber(n: number): DateString;
/** Whole days from `from` to `to`; null when either is missing. */
export function daysBetween(from: string | Date | null | undefined, to: string | Date | null | undefined, timeZone?: string): number | null;
export function addDays(date: DateString, days: number): DateString;
/** 0 = Sunday ... 6 = Saturday. */
export function weekday(date: DateString): number;
/** Monday of the ISO week. */
export function isoWeekStart(date: DateString): DateString;
export function isoWeek(date: DateString): { year: number; week: number };
/** '30 Aug'; '19 Oct 2025' when the year differs from `today`'s or `withYear` is set. */
export function formatShort(value: string | Date | null | undefined, opts?: { today?: DateString; withYear?: boolean; timeZone?: string }): string;
/** 'Sat 17 Oct' */
export function formatDay(date: DateString): string;
/** '1 day' / '5 days' */
export function pluralDays(n: number): string;
/** 'just now', '5 min ago', '2h ago', 'yesterday', '3 days ago' */
export function formatAgo(timestamp: string | Date | null | undefined, now?: Date | string): string;
export function maxDate(...dates: Array<string | null | undefined>): DateString | null;
export function minDate(...dates: Array<string | null | undefined>): DateString | null;

// ===========================================================================
// phases.mjs
// ===========================================================================

export const PHASES: readonly Phase[];
/** Plain words: draft 'Not sent', applied 'Sent · waiting', interviewing 'Interview', skipped 'Not applying', ... */
export const PHASE_LABELS: Readonly<Record<Phase, string>>;
/** History title of a status change by its target status ('Marked as no reply'). */
export const PHASE_CHANGE_TITLES: Readonly<Record<Phase, string>>;
export const SENT_PHASES: readonly Phase[];
export const OPEN_PHASES: readonly Phase[];
export const CLOSED_PHASES: readonly Phase[];
export const RESPONDED_PHASES: readonly Phase[];
export const WAITING_PHASES: readonly Phase[];
export function isPhase(p: unknown): p is Phase;
export function phaseLabel(p: string | null | undefined): string;
/** Phase is not draft or skipped. */
export function isSent(p: string | null | undefined): boolean;
export function isOpen(p: string | null | undefined): boolean;
export function isClosed(p: string | null | undefined): boolean;

export interface ListGroup { id: ListGroupId; label: string; phases: Phase[]; collapsed: boolean; note?: string; sort: string }
export const LIST_GROUPS: readonly ListGroup[];
/** Group by phase alone; use listGroupOf(derived) to honour the campaign window ('older'). */
export function phaseGroup(p: string | null | undefined): ListGroupId;

export type StatusGroupId = 'waiting' | 'interviews' | 'not_sent' | 'closed';
export interface StatusGroup { id: StatusGroupId; label: string; short: string; phases: Phase[] }
/** Home's four tiles and the Applications filter: Waiting for a reply, Interviews, Not sent yet, Closed. By phase alone. */
export const STATUS_GROUPS: readonly StatusGroup[];

export interface BoardColumn { id: BoardColumnId; label: string; phases: Phase[]; dropPhase: Phase | null; collapsed: boolean }
export const BOARD_COLUMNS: readonly BoardColumn[];
export function boardColumnOf(p: string | null | undefined): BoardColumnId;

export const LEGACY_STATUSES: readonly string[];
export const LEGACY_STAGES: readonly string[];
export const INTERVIEW_STAGES: readonly string[];
/** Mirrors SQL iv_phase_from_legacy. */
export function phaseFromLegacy(status: string | null | undefined, stage: string | null | undefined): Phase;
/** Mirrors SQL iv_legacy_status. */
export function legacyStatus(phase: string | null | undefined): 'Active' | 'Inactive' | 'Not Applied';
/** Mirrors SQL iv_legacy_stage. */
export function legacyStage(phase: string | null | undefined, oldStage: string | null | undefined): string;

export const EVENT_KINDS: readonly EventKind[];
export const EVENT_KIND_LABELS: Readonly<Record<EventKind, string>>;
/** Direction the insert trigger assigns when none is given. */
export function defaultDirection(kind: string): Direction;
/** Mirrors SQL iv_implied_phase. */
export function impliedPhase(kind: string, current: string | null | undefined): Phase | null;
/** event.title, else a label from the kind ('Moved to Rejected' for a phase_change). */
export function eventTitle(event: { kind: string; title?: string | null; to_phase?: string | null }): string;

export const CHANNELS: readonly Channel[];
export const CHANNEL_LABELS: Readonly<Record<Channel, string>>;
export const FOLLOW_UP_CHANNELS: readonly Channel[];
export const WORK_MODES: readonly WorkMode[];
export const VERDICTS: readonly Verdict[];
export const GAP_STATES: readonly GapState[];
/** Real gap / Worded around it / Left off on purpose / No longer a gap */
export const GAP_STATE_LABELS: Readonly<Record<GapState, string>>;
export const METRIC_STATUSES: readonly MetricStatus[];
export const METRIC_STATUS_LABELS: Readonly<Record<MetricStatus, string>>;
export const ROLE_FAMILY_LABELS: Readonly<Record<string, string>>;
export function roleFamilyLabel(family: string | null | undefined): string;
export const DOCUMENT_KINDS: readonly DocumentKind[];
export const SOURCES: readonly Source[];
export const TOPIC_LABELS: Readonly<Record<string, string>>;
export function topicLabel(topic: string | null | undefined): string;
export const STEPS: ReadonlyArray<{ id: 'cv_built' | 'sent' | 'first_reply' | 'interviews' | 'outcome'; label: string }>;

/** CSS custom-property names: phaseTokens('no_reply') -> { fg: '--phase-no-reply-fg', bg: '--phase-no-reply-bg' }. */
export function phaseTokens(phase: string): { fg: string; bg: string };
export const PHASE_TOKENS: Readonly<Record<Phase, { fg: string; bg: string }>>;
export const CAUTION_TOKENS: Readonly<{ fg: '--caution-fg'; bg: '--caution-bg' }>;
export interface ColorPair { fg: string; bg: string }
/** Section 3.4 hex values (fg = text and dot, bg = tint), for globals.css and scripts/contrast.mjs. */
export const PHASE_COLORS: Readonly<Record<Phase, { light: ColorPair; dark: ColorPair }>>;
export const CAUTION_COLORS: Readonly<{ light: ColorPair; dark: ColorPair }>;

// ===========================================================================
// slug.mjs
// ===========================================================================

export const SLUG_RE: RegExp;
export const SLUG_MAX: 81;
export function isValidSlug(s: unknown): s is string;
/** Lowercase ASCII slug from free text; '' when nothing usable is left. */
export function slugify(...parts: Array<string | null | undefined>): string;
/** slug, or the numeric id for legacy rows. */
export function appRef(app: { id: number | string; slug?: string | null }): string;
/** '/applications/<ref>' (basePath not included). */
export function appPath(app: { id: number | string; slug?: string | null }): string;
export type RefResult<T> = { ok: true; app: T } | { ok: false; error: 'not_found' | 'ambiguous'; matches: T[] };
/** Exact slug, then numeric id, then unique slug prefix. */
export function resolveRef<T extends { id: number | string; slug?: string | null }>(ref: string | number, apps: T[]): RefResult<T>;
/** rtrim(split_part(url, '?', 1), '/'), exactly as the RPC matches URLs. */
export function normalizeUrl(url: string | null | undefined): string;
/** Escape % _ and \ for ILIKE. */
export function escapeLike(s: string): string;

// ===========================================================================
// stats.mjs: the sample-size rule (spec 5.2), the only place it lives
// ===========================================================================

export const Z80: 1.2816;
export const MIN_N_RANGE: 20;
export const MIN_N_PERCENT: 30;
export const MIN_N_GROUP: 10;
export const MIN_N_MEDIAN: 5;
/** n < 20 'counts'; 20-29 'range'; 30+ 'percent'. */
export function displayFor(n: number): Display;
export interface WilsonInterval { k: number; n: number; p: number; center: number; halfWidth: number; low: number; high: number }
/** 80% Wilson score interval by default; null when n = 0. */
export function wilson(k: number, n: number, z?: number): WilsonInterval | null;
export function formatPercent(p: number): string;

/**
 * Below n = 20 a Rate has NO p / low / high / percentText / rangeText at all.
 * text: '1 of 6' (n<20), '5 of 24 (21%)' (20-29), '21% (7 of 33)' (30+).
 */
export type Rate =
  | { k: number; n: number; display: 'counts'; text: string; countText: string }
  | { k: number; n: number; display: 'range' | 'percent'; text: string; countText: string; p: number; low: number; high: number; percentText: string; rangeText: string };
export function describeRate(k: number, n: number): Rate;
export function intervalsOverlap(a: { low: number; high: number }, b: { low: number; high: number }): boolean;

export interface GroupInput { key: string; label?: string; k: number; n: number }
export interface GroupComparison {
  /** Every group has n >= 10 (and there are 2+ groups with n > 0). */
  allowed: boolean;
  reason: 'too_few' | 'no_difference' | null;
  /** `interval` is null below n = 20 (no range may be drawn). */
  groups: Array<GroupInput & { label: string; rate: Rate; interval: WilsonInterval | null }>;
  /** Only when allowed, only pairs whose 80% intervals do not overlap. */
  statements: Array<{ higher: string; lower: string; text: string }>;
  /** 'Too few to compare yet.' | 'No clear difference yet.' | the first statement */
  line: string;
}
export function compareGroups(groups: GroupInput[], opts?: { minN?: number; verb?: string }): GroupComparison;
/** `value` only with 5+ values; otherwise list `values`. */
export function median(values: number[]): { count: number; allowed: boolean; values: number[]; value?: number };
/** null below 5 values. */
export function quantile(values: number[], q: number): number | null;

// ===========================================================================
// derive.mjs: shared definitions (spec 5.1)
// ===========================================================================

export const DEFAULT_SETTINGS: Readonly<UserSettings>;
export function resolveSettings(settings: Partial<UserSettings> | null | undefined): UserSettings;
export function groupRows<T>(rows: T[] | null | undefined, key: (row: T) => string | number | null | undefined): Map<string, T[]>;
/** Oldest first: occurred_on, occurred_at, id. */
export function sortEvents<T extends JobEvent>(events: T[]): T[];

/** Everything section 5.1 defines, computed once per application. */
export interface Derived {
  app: JobOverviewRow;
  id: number;
  slug: string | null;
  ref: string;
  company: string;
  role: string;
  phase: Phase;
  uncertain: string[];
  /** uncertain is not empty: count it, draw it hollow */
  unconfirmed: boolean;
  /** 'phase' is unsure (was it really sent?) */
  statusUnconfirmed: boolean;
  /** coalesce(applied_on, cv_built_on, created_at::date) */
  windowDate: DateString | null;
  /** windowDate >= campaign_start; false = "older record" */
  inWindow: boolean;
  sent: boolean;
  /** sent and applied_on is set; only dated rows enter a denominator */
  dated: boolean;
  appliedOn: DateString | null;
  cvBuiltOn: DateString | null;
  daysSinceApplied: number | null;
  draftAgeDays: number | null;
  /** first inbound, non-auto_ack event on or before today */
  responseOn: DateString | null;
  /** responseOn set, or phase screening / interviewing / offer / rejected (a rejection is a response) */
  responded: boolean;
  responseDays: number | null;
  /** old enough to judge: dated and (age >= mature_after_days or responded) */
  mature: boolean;
  lastInboundOn: DateString | null;
  lastFollowUpOn: DateString | null;
  lastEventOn: DateString | null;
  lastEvent: JobEvent | null;
  /** max(applied_on, last_inbound_on, last_follow_up_on) */
  silenceBase: DateString | null;
  silenceDays: number | null;
  interviewed: boolean;
  offered: boolean;
  lastInviteOn: DateString | null;
  nextInterviewOn: DateString | null;
  nextInterviewAt: Timestamp | null;
  hasContact: boolean;
  contactCount: number;
  events: JobEvent[];
}
export function deriveApp(app: JobOverviewRow, ctx: { settings: UserSettings; today: DateString; events: JobEvent[] | null; contacts: Contact[] | null }): Derived;
export interface Context {
  settings: UserSettings;
  today: DateString;
  all: Derived[];
  byId: Map<number, Derived>;
  requirementsByJob: Map<string, JobRequirement[]>;
  jobProofPointsByJob: Map<string, JobProofPoint[]>;
  requirements: JobRequirement[];
  jobProofPoints: JobProofPoint[];
  proofPoints: ProofPoint[];
  events: JobEvent[];
  contacts: Contact[];
}
export function buildContext(input: CoreInput): Context;
/** List group with the campaign window: rows before campaign_start are 'older'. */
export function listGroupOf(d: Derived): ListGroupId;
/** '3 weeks' when whole weeks (14+), else '21 days'. */
export function weeksOrDays(days: number): string;

// ===========================================================================
// now.mjs
// ===========================================================================

export interface NowContext { today: DateString; events?: JobEvent[] | null; settings?: Partial<UserSettings> | null }
/** The deterministic "now" sentence (spec 2.2). Pass all events; they are filtered by job_id. */
export function nowSentence(app: JobOverviewRow | Derived, ctx: NowContext): string;
/** Age-bar value: days waiting, for applied/screening rows; null otherwise or undated. */
export function waitingDays(app: JobOverviewRow | Derived, ctx: NowContext): number | null;
/** Date of the newest event that moved the row into `phase`; null when unknown. */
export function phaseChangedOn(phase: string, events: JobEvent[]): DateString | null;
export interface StepperStep { id: 'cv_built' | 'sent' | 'first_reply' | 'interviews' | 'outcome'; label: string; date: DateString | null; reached: boolean; current: boolean; note?: string }
export interface Stepper { steps: StepperStep[]; gaps: Array<{ from: string; to: string; days: number }>; currentIndex: number }
/** CV built -> Sent -> First reply -> Interviews -> Outcome, with day counts between dated steps. */
export function buildStepper(app: JobOverviewRow | Derived, ctx: NowContext): Stepper;

// ===========================================================================
// today.mjs (spec 5.3)
// ===========================================================================

export interface AppRef { appId: number; slug: string | null; ref: string; company: string; role: string; phase: Phase }
export interface ItemAction { id: string; label: string }

export type ConfirmOption =
  | 'yes' | 'different_date' | 'not_sent' | 'yes_on_date' | 'not_yet' | 'dropped' | 'date'
  | 'rejected' | 'offer' | 'withdrawn' | 'sent_on_date' | 'change';
export interface ConfirmQuestion extends AppRef {
  key: string;
  position: number;
  /** 'sent' questions come first, then 'date', then 'phase', then 'other'. */
  kind: 'sent' | 'date' | 'phase' | 'other';
  /** The uncertain fields this answer confirms (remove them from `uncertain`). */
  fields: string[];
  text: string;
  options: ConfirmOption[];
}

interface ItemBase { rank: number; key: string; reason: string; evidence: string; action: ItemAction; secondary?: ItemAction }
export interface InterviewSoonItem extends ItemBase, AppRef { type: 'interview_soon'; rank: 1; days: number; date: DateString; at: Timestamp | null; check: boolean }
export interface OutcomeMissingItem extends ItemBase, AppRef { type: 'outcome_missing'; rank: 2; days: number; lastEventOn: DateString | null; inviteOn: DateString | null; daysSinceInvite: number | null }
export interface NextActionDueItem extends ItemBase, AppRef { type: 'next_action_due'; rank: 3; days: number; due: DateString }
export interface ConfirmFactsItem extends ItemBase { type: 'confirm_facts'; rank: 4; rows: number; fields: number; questions: ConfirmQuestion[] }
export interface FollowUpItem extends ItemBase, AppRef { type: 'follow_up'; rank: 5; days: number; contactCount: number }
export interface NoReplyEntry extends AppRef { days: number; appliedOn: DateString | null; unconfirmed: boolean; statusUnconfirmed: boolean; postingGone: boolean }
export interface NoReplyItem extends ItemBase { type: 'no_reply'; rank: 6; days: number; entries: NoReplyEntry[] }
export interface ClosingSoonItem extends ItemBase, AppRef { type: 'closing_soon'; rank: 7; days: number; closesOn: DateString }
export interface PostingClosedItem extends ItemBase, AppRef { type: 'posting_closed'; rank: 8; hint: string | null; days: number | null }
export interface StaleDraftItem extends ItemBase, AppRef { type: 'stale_draft'; rank: 9; days: number }
export interface FixBaseCvItem extends ItemBase { type: 'fix_base_cv'; rank: 10; topics: Array<{ topic: string; label: string; task: string; apps: AppRef[] }> }
export type TodayItem =
  | InterviewSoonItem | OutcomeMissingItem | NextActionDueItem | ConfirmFactsItem | FollowUpItem
  | NoReplyItem | ClosingSoonItem | PostingClosedItem | StaleDraftItem | FixBaseCvItem;

export interface DotItem { state: DotState; unconfirmed: boolean; label: string; slug: string | null; ref?: string }

export interface TodayResult {
  today: DateString;
  /** 'Today · Sat 17 Oct' */
  heading: string;
  summary: { sent: number; interviewing: number; notSent: number; lastSentOn: DateString | null; lastSentDaysAgo: number | null; line: string };
  /** In priority order, snoozed / dismissed items removed. */
  items: TodayItem[];
  /** How many items `dismissed` removed. */
  hidden: number;
  empty: boolean;
  /** 'Nothing needs you. Last sent 6 days ago.' */
  emptyLine: string;
  comingUp: {
    interviews: Array<AppRef & { on: DateString | null; at: Timestamp | null; days: number | null }>;
    closing: Array<AppRef & { on: DateString | null; days: number | null }>;
  };
  /** Last 3 applications with source = 'cli'. */
  recentlyAdded: Array<AppRef & { createdAt: Timestamp | null; updatedAt: Timestamp | null; hasCv: boolean }>;
  /** 'Replies so far' strip: same numbers as I2. */
  replies: { rate: Rate; tooRecent: number; undated: number; dots: DotItem[]; line: string };
}
export interface TodayOptions {
  /** {itemKey: untilISO} from localStorage iv.today.dismissed; an item is hidden while until >= today. */
  dismissed?: Record<string, string>;
}
export function buildToday(input: CoreInput, opts?: TodayOptions): TodayResult;
export function confirmQuestions(rows: Derived[], today: DateString, draftStaleAfter: number): ConfirmQuestion[];

export interface InterviewChecks {
  /** phase interviewing or an interview 0-7 days away, and something to check */
  show: boolean;
  /** caution fit items: `evidence` holds the correct fact */
  cautions: Array<{ requirement: string; evidence: string | null; topic: string | null }>;
  /** proof points used here whose metric_status is not 'verified', with the wording this company saw */
  proofPoints: Array<{ key: string; name: string; metricStatus: MetricStatus; caveat: string | null; detail: string | null; facts: Record<string, unknown> }>;
  interviewOn: DateString | null;
}
/** The dossier's "Before the interview, check" callout (spec 2.3). */
export function beforeInterviewChecks(input: CoreInput, jobId: number | string): InterviewChecks;

export interface CliAction { type: string; slug: string | null; company: string | null; role: string | null; days: number | null; reason: string; suggested_commands: string[] }
export function itemToActions(item: TodayItem, today: DateString): CliAction[];
/** `intervous insights --only actions --json` */
export function todayActions(input: CoreInput): { generated_on: DateString; actions: CliAction[] };

// ===========================================================================
// insights.mjs (spec 5.4)
// ===========================================================================

export interface InsightOptions {
  /** 'campaign' (default): rows since settings.campaign_start. 'all': every row. */
  window?: 'campaign' | 'all';
  /** Leave out rows whose `uncertain` is not empty. */
  onlyConfirmed?: boolean;
}

interface SectionBase { question: string; answer: string; n: number; display: Display; todo: string; howCounted: string }

export interface ExtractedNumber { raw: string; phrase: string; value: number; atLeast: boolean; metric: string }
export function extractNumbers(text: string | null | undefined): ExtractedNumber[];
/** '$230K–385K a year', '€4,982 a month'; null without min/max. */
export function formatSalary(row: Pick<JobOverviewRow, 'salary_min' | 'salary_max' | 'salary_currency' | 'salary_period'>): string | null;

export interface I1Row extends AppRef { days: number; appliedOn: DateString | null; bucket: 'wait' | 'follow_up' | 'likely_closed'; unconfirmed: boolean; statusUnconfirmed: boolean; actions: ItemAction[] }
export interface I1 extends SectionBase {
  id: 'i1';
  rows: I1Row[];
  buckets: Array<{ id: 'likely_closed' | 'follow_up' | 'wait'; label: string; range: string; rows: I1Row[] }>;
  undated: Array<AppRef & { unconfirmed: boolean; statusUnconfirmed: boolean }>;
}
export interface I2 extends SectionBase {
  id: 'i2';
  rate: Rate;
  dots: DotItem[];
  responders: Array<AppRef & { days: number | null }>;
  tooRecent: number;
  recent: Array<AppRef & { days: number | null; state: 'recent' }>;
  undated: AppRef[];
  unconfirmedIncluded: number;
}
export interface Funnel {
  steps: Array<{ id: 'sent' | 'responded' | 'interview' | 'offer'; label: string; count: number }>;
  /** describeRate per step: no percentage below n = 20 */
  rates: Array<{ from: string; to: string; rate: Rate }>;
  /** '11 → 1 → 1 → 0' */
  line: string;
}
export interface I3 extends SectionBase, Funnel { id: 'i3'; older: Funnel & { count: number; label: string; note: string } }
export interface I4 extends SectionBase {
  id: 'i4';
  dots: Array<AppRef & { days: number | null; unconfirmed: boolean }>;
  axisMax: 60;
  unknownDates: number;
  median: { count: number; allowed: boolean; values: number[]; value?: number };
  p75: number | null;
  /** One-click threshold change, only with 5+ dated replies. */
  suggestion: { no_reply_after_days: number; follow_up_after_days: number } | null;
}
export interface I5 extends SectionBase {
  id: 'i5';
  /** Last 12 ISO weeks, oldest first; `start` is the Monday. Shape matches WeekBars. */
  weeks: Array<{ start: DateString; series: { built: number; sent: number } }>;
  drafts: Array<AppRef & { ageDays: number | null; cvBuiltOn: DateString | null; postingGone: boolean }>;
  draftCount: number;
  builtToday: number;
  sentWithin14: Rate;
  burst: { on: DateString; count: number; of: number; text: string } | null;
}
export interface I6Topic {
  topic: string;
  label: string;
  /** distinct postings */
  count: number;
  apps: Array<AppRef & { gapState: GapState; outcome: 'yes' | 'no' | 'waiting' | null; items: string[] }>;
  byGapState: Partial<Record<GapState, number>>;
}
export interface I6 extends SectionBase {
  id: 'i6';
  /** topics in 2+ postings, most first ('other' excluded) */
  topics: I6Topic[];
  singleTopics: Array<{ topic: string; label: string; count: number }>;
  otherItems: number;
  /** "No longer a gap: update the base CV" (struck through) */
  noLongerGaps: Array<{ topic: string; label: string; apps: AppRef[] }>;
}
export interface I7Flag {
  type: 'differs_from_fact' | 'inconsistent' | 'unlabeled';
  metric: string;
  text: string;
  value?: string;
  phrase?: string;
  fact?: string | number | boolean | null;
  values?: Array<{ value: number; apps: string[] }>;
  appId?: number; slug?: string | null; company?: string; role?: string;
}
export interface I7Wording extends AppRef { sent: boolean; detail: string | null; numbers: ExtractedNumber[] }
export interface I7ProofPoint {
  id: string; key: string; name: string; metric: string | null; metricStatus: MetricStatus; caveat: string | null;
  facts: Record<string, unknown>;
  /** applications using it (all phases) */
  uses: number;
  /** of which sent */
  sentUses: number;
  wordings: I7Wording[];
  flags: I7Flag[];
  flagged: boolean;
}
export interface I7 extends SectionBase {
  id: 'i7';
  /** most used first */
  proofPoints: I7ProofPoint[];
  flagged: Array<{ key: string; name: string; flags: I7Flag[]; wordings: I7Wording[] }>;
  /** metric_status != verified, used by an application in an open phase */
  unverifiedInUse: Array<{ key: string; name: string; metricStatus: MetricStatus; caveat: string | null; apps: AppRef[] }>;
}
export interface I8Dimension {
  id: 'visa_needed' | 'role_family' | 'channel' | 'country_code';
  label: string;
  comparison: GroupComparison;
  groups: Array<{ key: string; label: string; k: number; n: number; rate: Rate; dots: DotItem[] }>;
}
export interface I8 extends SectionBase { id: 'i8'; dimensions: I8Dimension[]; visa: { needed: number; of: number; line: string } }
export interface I9 extends SectionBase {
  id: 'i9';
  unconfirmed: { count: number; fields: number; rows: Array<AppRef & { uncertain: string[] }> };
  cvNotMarkedSent: { count: number; rows: AppRef[] };
  sentWithoutCv: { count: number; rows: AppRef[] };
  unsavedAnswers: { count: number; rows: Array<AppRef & { count: number }> };
}
export interface SalaryRow extends AppRef { text: string | null; min: number | string | null; max: number | string | null; display: string | null }
export interface I10 extends SectionBase {
  id: 'i10';
  groups: Array<{ currency: string; period: SalaryPeriod | null; rows: SalaryRow[] }>;
  /** text only (e.g. a formula) */
  unparsed: SalaryRow[];
}
export type InsightSection = I1 | I2 | I3 | I4 | I5 | I6 | I7 | I8 | I9 | I10;

export interface InsightsResult {
  generatedOn: DateString;
  window: 'campaign' | 'all';
  /** 'Since 1 Aug 2026' | 'All' */
  windowLabel: string;
  onlyConfirmed: boolean;
  unconfirmedInScope: number;
  /** 'includes 16 unconfirmed' (null with onlyConfirmed) */
  badge: string | null;
  /** 'Based on 11 sent applications, 6 of them old enough to judge. Too few for percentages, so most answers are counts.' */
  intro: string;
  sample: { tracked: number; sent: number; dated: number; undated: number; mature: number; responded: number; drafts: number; unconfirmed: number; older: number };
  /** I1..I10 in page order */
  sections: [I1, I2, I3, I4, I5, I6, I7, I8, I9, I10];
  i1: I1; i2: I2; i3: I3; i4: I4; i5: I5; i6: I6; i7: I7; i8: I8; i9: I9; i10: I10;
  /** "incomplete, not comparable": always computed from rows before campaign_start */
  older: { count: number; label: string; note: string; funnel: Funnel; rows: Array<AppRef & { appliedOn: DateString | null; unconfirmed: boolean }> };
  /** Same as todayActions(input).actions */
  actions: CliAction[];
}
export function computeInsights(input: CoreInput, opts?: InsightOptions): InsightsResult;
/** `intervous insights --json`: one object per insight with n, allowed_display and the numbers. */
export function insightsForCli(input: CoreInput, opts?: InsightOptions): {
  generated_on: DateString;
  window: 'campaign' | 'all';
  intro: string;
  sample: InsightsResult['sample'];
  insights: Array<{ id: string; question: string; answer: string; n: number; allowed_display: Display; what_to_do: string; how_counted: string; numbers: Record<string, unknown> }>;
  older: InsightsResult['older'];
  actions: CliAction[];
};

// ===========================================================================
// home.mjs (/home)
// ===========================================================================

export const HOME_MAX_ACTIONS: number;
export const HOME_MAX_LEARNED: number;
/** 'Apple', 'Apple and Meta', 'Apple, Meta and OpenAI' */
export function joinNames(names: string[]): string;

export interface StatusCount { id: StatusGroupId; label: string; short: string; count: number }
export function statusCounts(ctx: Context): StatusCount[];
export function summarySentence(c: { waiting: number; interviewing: number; offers: number; notSent: number; total: number }): string;

export interface ConfirmBatch {
  /** 'confirm_facts:drafts:2026-10', 'confirm_facts:sent', 'confirm_facts:other' */
  key: string;
  kind: 'drafts' | 'sent' | 'other';
  month: string | null;
  apps: AppRef[];
  questions: ConfirmQuestion[];
  /** 'Did you send the 5 CVs made in October? Confirm them so replies can be tracked.' */
  text: string;
}
export function confirmBatches(questions: ConfirmQuestion[], ctx: Context): ConfirmBatch[];

export type HomeButtonId = 'open' | 'update' | 'done' | 'confirm' | 'copy_follow_up' | 'mark_no_reply' | 'mark_sent' | 'drop' | 'checklist_done';
export interface HomeAction {
  /** Key for "Not now" (the Today item key, or the confirm batch key). */
  key: string;
  type: TodayItem['type'];
  /** One plain sentence: what to do and why. */
  text: string;
  button: { id: HomeButtonId; label: string };
  /** The one application it is about, when there is one. */
  app: AppRef | null;
  /** Every application it covers (no-reply entries, a confirm batch, base-CV topics). */
  apps: AppRef[];
  /** A confirm batch's questions. */
  questions?: ConfirmQuestion[];
  /** An extra link in the sentence (a newer job post). */
  link: { href: string; label: string } | null;
  /** The Today item it comes from. */
  item: TodayItem;
}
export function homeActionsFor(item: TodayItem, ctx: Context): HomeAction[];
export function learnedSentences(ins: InsightsResult, ctx: Context): Array<{ id: string; text: string }>;

export interface HomeOptions {
  /** {actionKey: untilISO}: "Not now"; hidden while until >= today. */
  dismissed?: Record<string, string>;
}
export interface HomeResult {
  today: DateString;
  /** '10 applications are waiting for a reply and 1 is at interview stage.' */
  summary: string;
  /** At most HOME_MAX_ACTIONS, in Today's priority order; one confirm batch at a time. */
  actions: HomeAction[];
  /** Actions waiting behind the ones shown. */
  more: number;
  /** Keys hidden with "Not now". */
  hiddenKeys: string[];
  empty: boolean;
  /** 'Nothing to do today.' */
  emptyLine: string;
  tiles: StatusCount[];
  /** At most HOME_MAX_LEARNED plain sentences. */
  learned: Array<{ id: string; text: string }>;
}
export function buildHome(input: CoreInput, opts?: HomeOptions): HomeResult;
