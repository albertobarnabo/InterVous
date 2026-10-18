// Phases, list groups, board columns, legacy status/stage maps, event kinds and colour tokens.
// This is the only copy of these maps: the UI, the CLI and the tests import them from here.
// The legacy maps mirror the SQL functions iv_phase_from_legacy / iv_legacy_status /
// iv_legacy_stage / iv_implied_phase in supabase/migrations/20261017120000_intervous_v2.sql.

/** @typedef {'draft'|'applied'|'screening'|'interviewing'|'offer'|'rejected'|'no_reply'|'withdrawn'|'skipped'} Phase */

/** @type {readonly Phase[]} */
export const PHASES = Object.freeze([
  'draft', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'no_reply', 'withdrawn', 'skipped',
]);

/** Plain words for each status, as the UI shows them. @type {Readonly<Record<Phase, string>>} */
export const PHASE_LABELS = Object.freeze({
  draft: 'Not sent',
  applied: 'Sent · waiting',
  screening: 'In process',
  interviewing: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  no_reply: 'No reply',
  withdrawn: 'Withdrawn',
  skipped: 'Not applying',
});

/** History title of a status change, by the status it moved to. @type {Readonly<Record<Phase, string>>} */
export const PHASE_CHANGE_TITLES = Object.freeze({
  draft: 'Marked as not sent',
  applied: 'Marked as sent',
  screening: 'Moved to in process',
  interviewing: 'Moved to interview',
  offer: 'Marked as offer',
  rejected: 'Marked as rejected',
  no_reply: 'Marked as no reply',
  withdrawn: 'Marked as withdrawn',
  skipped: 'Marked as not applying',
});

/** Phases that mean the application went out. */
export const SENT_PHASES = Object.freeze(/** @type {Phase[]} */ (
  ['applied', 'screening', 'interviewing', 'offer', 'rejected', 'no_reply', 'withdrawn']));
/** Phases that are still moving (a draft can still be sent). */
export const OPEN_PHASES = Object.freeze(/** @type {Phase[]} */ (['draft', 'applied', 'screening', 'interviewing', 'offer']));
/** Phases that end the application. */
export const CLOSED_PHASES = Object.freeze(/** @type {Phase[]} */ (['rejected', 'no_reply', 'withdrawn', 'skipped']));
/** Phases that count as "responded" even with no inbound event (section 5.1). A rejection is a response. */
export const RESPONDED_PHASES = Object.freeze(/** @type {Phase[]} */ (['screening', 'interviewing', 'offer', 'rejected']));
/** Phases where the company still owes a first answer or the process is waiting on them. */
export const WAITING_PHASES = Object.freeze(/** @type {Phase[]} */ (['applied', 'screening']));

/**
 * @param {unknown} p
 * @returns {p is Phase}
 */
export function isPhase(p) {
  return typeof p === 'string' && /** @type {readonly string[]} */ (PHASES).includes(p);
}

/**
 * @param {string | null | undefined} p
 * @returns {string}
 */
export function phaseLabel(p) {
  return isPhase(p) ? PHASE_LABELS[p] : (p ?? '');
}

/** Sent: phase is not draft or skipped (section 5.1). @param {string | null | undefined} p */
export function isSent(p) {
  return isPhase(p) && p !== 'draft' && p !== 'skipped';
}
/** @param {string | null | undefined} p */
export function isOpen(p) {
  return isPhase(p) && OPEN_PHASES.includes(p);
}
/** @param {string | null | undefined} p */
export function isClosed(p) {
  return isPhase(p) && CLOSED_PHASES.includes(p);
}

// ---------------------------------------------------------------------------
// List groups (section 2.2) and board columns
// ---------------------------------------------------------------------------

/** @typedef {'interviews'|'waiting'|'not_sent'|'closed'|'older'} ListGroupId */

/** @type {ReadonlyArray<{id: ListGroupId, label: string, phases: Phase[], collapsed: boolean, note?: string, sort: string}>} */
export const LIST_GROUPS = Object.freeze([
  { id: 'interviews', label: 'In interviews', phases: ['interviewing', 'offer'], collapsed: false, sort: 'latest activity first' },
  { id: 'waiting', label: 'Waiting', phases: ['applied', 'screening'], collapsed: false, sort: 'longest wait first' },
  { id: 'not_sent', label: 'Not sent', phases: ['draft'], collapsed: false, sort: 'newest CV first' },
  { id: 'closed', label: 'Closed', phases: ['rejected', 'no_reply', 'withdrawn', 'skipped'], collapsed: true, sort: 'latest first' },
  { id: 'older', label: 'Older records', phases: [], collapsed: true, note: 'From the old tracker, incomplete', sort: 'latest first' },
]);

/** @typedef {'waiting'|'interviews'|'not_sent'|'closed'} StatusGroupId */

/**
 * The four plain status groups of Home's tiles and the Applications filter. Every application is in
 * exactly one, by its phase alone (no campaign window), so a tile's number is the list's row count.
 * @type {ReadonlyArray<{id: StatusGroupId, label: string, short: string, phases: Phase[]}>}
 */
export const STATUS_GROUPS = Object.freeze([
  { id: 'waiting', label: 'Waiting for a reply', short: 'Waiting', phases: ['applied', 'screening'] },
  { id: 'interviews', label: 'Interviews', short: 'Interviews', phases: ['interviewing', 'offer'] },
  { id: 'not_sent', label: 'Not sent yet', short: 'Not sent', phases: ['draft'] },
  { id: 'closed', label: 'Closed', short: 'Closed', phases: ['rejected', 'no_reply', 'withdrawn', 'skipped'] },
]);

/**
 * List group of a phase, ignoring the campaign window (see `listGroupOf` in derive.mjs for the window).
 * The same id as its STATUS_GROUPS entry.
 * @param {string | null | undefined} p
 * @returns {ListGroupId}
 */
export function phaseGroup(p) {
  for (const g of LIST_GROUPS) if (isPhase(p) && g.phases.includes(p)) return g.id;
  return 'waiting';
}

/** @typedef {'draft'|'applied'|'screening'|'interviewing'|'offer'|'closed'} BoardColumnId */

/**
 * Board columns. `dropPhase` is the phase a card dropped on the column moves to; the Closed
 * column has none, so the drop popover asks which closing phase (rejected / no reply / ...).
 * @type {ReadonlyArray<{id: BoardColumnId, label: string, phases: Phase[], dropPhase: Phase | null, collapsed: boolean}>}
 */
export const BOARD_COLUMNS = Object.freeze([
  { id: 'draft', label: 'Not sent', phases: ['draft'], dropPhase: 'draft', collapsed: false },
  { id: 'applied', label: 'Sent', phases: ['applied'], dropPhase: 'applied', collapsed: false },
  { id: 'screening', label: 'In process', phases: ['screening'], dropPhase: 'screening', collapsed: false },
  { id: 'interviewing', label: 'Interviewing', phases: ['interviewing'], dropPhase: 'interviewing', collapsed: false },
  { id: 'offer', label: 'Offer', phases: ['offer'], dropPhase: 'offer', collapsed: false },
  { id: 'closed', label: 'Closed', phases: ['rejected', 'no_reply', 'withdrawn', 'skipped'], dropPhase: null, collapsed: true },
]);

/**
 * @param {string | null | undefined} p
 * @returns {BoardColumnId}
 */
export function boardColumnOf(p) {
  for (const c of BOARD_COLUMNS) if (isPhase(p) && c.phases.includes(p)) return c.id;
  return 'applied';
}

// ---------------------------------------------------------------------------
// Legacy status / stage (mirror of the SQL functions; the old UI keeps working)
// ---------------------------------------------------------------------------

export const LEGACY_STATUSES = Object.freeze(['Active', 'Inactive', 'Not Applied']);
export const LEGACY_STAGES = Object.freeze(['-', 'Screening', 'Coding Assessment', 'Video Interview', 'HR Interview', 'Technical Interview', 'Final Round']);
/** Legacy stages that mean an interview happened (I3's interview step). */
export const INTERVIEW_STAGES = Object.freeze(['Video Interview', 'HR Interview', 'Technical Interview', 'Final Round']);

/**
 * iv_phase_from_legacy(status, stage)
 * @param {string | null | undefined} status
 * @param {string | null | undefined} stage
 * @returns {Phase}
 */
export function phaseFromLegacy(status, stage) {
  const s = String(status ?? '').toLowerCase();
  const st = String(stage ?? '').toLowerCase();
  if (s === 'not applied') return 'draft';
  if (s === 'inactive' || s === 'rejected' || s === 'closed') return 'rejected';
  if (['video interview', 'hr interview', 'technical interview', 'final round'].includes(st)) return 'interviewing';
  if (st === 'coding assessment') return 'screening';
  return 'applied';
}

/**
 * iv_legacy_status(phase)
 * @param {string | null | undefined} phase
 * @returns {'Active'|'Inactive'|'Not Applied'}
 */
export function legacyStatus(phase) {
  if (phase === 'draft' || phase === 'skipped') return 'Not Applied';
  if (phase === 'applied' || phase === 'screening' || phase === 'interviewing' || phase === 'offer') return 'Active';
  return 'Inactive';
}

/**
 * iv_legacy_stage(phase, old_stage)
 * @param {string | null | undefined} phase
 * @param {string | null | undefined} oldStage
 * @returns {string}
 */
export function legacyStage(phase, oldStage) {
  switch (phase) {
    case 'draft':
    case 'skipped': return '-';
    case 'applied': return 'Screening';
    case 'screening': return oldStage === 'Coding Assessment' ? oldStage : 'Screening';
    case 'interviewing': return oldStage && INTERVIEW_STAGES.includes(oldStage) ? oldStage : 'Video Interview';
    case 'offer': return 'Final Round';
    default: return oldStage && oldStage !== '-' ? oldStage : 'Screening';
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** @typedef {'cv_built'|'applied'|'auto_ack'|'reply'|'assessment'|'interview_scheduled'|'interview_done'|'follow_up_sent'|'rejection'|'offer'|'withdrawn'|'skipped'|'posting_closed'|'phase_change'|'note'} EventKind */

/** @type {readonly EventKind[]} */
export const EVENT_KINDS = Object.freeze([
  'cv_built', 'applied', 'auto_ack', 'reply', 'assessment', 'interview_scheduled', 'interview_done',
  'follow_up_sent', 'rejection', 'offer', 'withdrawn', 'skipped', 'posting_closed', 'phase_change', 'note',
]);

/** @type {Readonly<Record<EventKind, string>>} */
export const EVENT_KIND_LABELS = Object.freeze({
  cv_built: 'CV built',
  applied: 'Sent',
  auto_ack: 'Automatic acknowledgement',
  reply: 'Reply',
  assessment: 'Assessment',
  interview_scheduled: 'Interview scheduled',
  interview_done: 'Interview done',
  follow_up_sent: 'Followed up',
  rejection: 'Rejection',
  offer: 'Offer',
  withdrawn: 'Withdrawn',
  skipped: 'Decided not to apply',
  posting_closed: 'Posting closed',
  phase_change: 'Status changed',
  note: 'Note',
});

/**
 * Default direction of an event, as the iv_events_before_insert trigger sets it.
 * @param {string} kind
 * @returns {'in'|'out'|'self'}
 */
export function defaultDirection(kind) {
  if (['auto_ack', 'reply', 'assessment', 'interview_scheduled', 'rejection', 'offer'].includes(kind)) return 'in';
  if (['applied', 'follow_up_sent', 'withdrawn'].includes(kind)) return 'out';
  return 'self';
}

/**
 * iv_implied_phase(kind, current): the phase an event moves the application to, or null.
 * @param {string} kind
 * @param {string | null | undefined} current
 * @returns {Phase | null}
 */
export function impliedPhase(kind, current) {
  switch (kind) {
    case 'applied': return current == null || current === 'draft' || current === 'skipped' ? 'applied' : null;
    case 'reply': return current === 'applied' ? 'screening' : null;
    case 'assessment': return current === 'applied' || current === 'screening' ? 'screening' : null;
    case 'interview_scheduled': return current === 'applied' || current === 'screening' ? 'interviewing' : null;
    case 'rejection': return 'rejected';
    case 'offer': return 'offer';
    case 'withdrawn': return 'withdrawn';
    case 'skipped': return 'skipped';
    default: return null;
  }
}

/**
 * Display title of an event: its own title, else a label from its kind
 * ('Marked as rejected' for a phase_change to rejected).
 * @param {{kind: string, title?: string | null, to_phase?: string | null}} event
 * @returns {string}
 */
export function eventTitle(event) {
  if (event.title) return event.title;
  if (event.kind === 'phase_change') return isPhase(event.to_phase) ? PHASE_CHANGE_TITLES[event.to_phase] : 'Status changed';
  return /** @type {Record<string, string>} */ (EVENT_KIND_LABELS)[event.kind] ?? event.kind;
}

// ---------------------------------------------------------------------------
// Other CHECK values
// ---------------------------------------------------------------------------

export const CHANNELS = Object.freeze(['ats', 'portal', 'referral', 'recruiter', 'linkedin', 'email', 'other']);
export const CHANNEL_LABELS = Object.freeze({
  ats: 'Company ATS', portal: 'Portal', referral: 'Referral', recruiter: 'Recruiter', linkedin: 'LinkedIn', email: 'Email', other: 'Other',
});
/** Channels where a follow-up has someone to go to even without a contact on file. */
export const FOLLOW_UP_CHANNELS = Object.freeze(['referral', 'recruiter', 'email']);
export const WORK_MODES = Object.freeze(['onsite', 'hybrid', 'remote']);
export const VERDICTS = Object.freeze(['met', 'partial', 'gap', 'caution']);
export const GAP_STATES = Object.freeze(['open', 'worded_around', 'not_claimed', 'no_longer_true']);
export const GAP_STATE_LABELS = Object.freeze({
  open: 'Real gap', worded_around: 'Worded around it', not_claimed: 'Left off on purpose', no_longer_true: 'No longer a gap',
});
export const METRIC_STATUSES = Object.freeze(['verified', 'needs_care', 'unverified']);
export const METRIC_STATUS_LABELS = Object.freeze({ verified: 'Verified', needs_care: 'Needs care', unverified: 'Unverified' });
/** role_family values seen so far (free text in the schema). */
export const ROLE_FAMILY_LABELS = Object.freeze({
  applied_ai_ic: 'Applied AI engineer',
  forward_deployed: 'Forward deployed',
  product_engineer: 'Product engineer',
  public_institution: 'Public institution',
});

/**
 * @param {string | null | undefined} family
 * @returns {string}
 */
export function roleFamilyLabel(family) {
  if (!family) return 'Unknown';
  const known = /** @type {Record<string, string>} */ (ROLE_FAMILY_LABELS)[family];
  if (known) return known;
  const s = family.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export const DOCUMENT_KINDS = Object.freeze(['cv_pdf', 'cv_source', 'jd_snapshot', 'cover_letter', 'other']);
export const SOURCES = Object.freeze(['web', 'cli', 'import']);

/** Display names for gap topics (lowercase snake_case keys in job_requirements.topic). */
export const TOPIC_LABELS = Object.freeze({
  years_experience: 'Years or seniority',
  customer_facing_title: 'Customer-facing or FDE title',
  leadership: 'Leadership',
  german: 'German',
  kubernetes: 'Kubernetes',
  terraform: 'Terraform',
  kafka: 'Kafka',
  spark: 'Spark',
  csharp: 'C#',
  grpc: 'gRPC',
  clickhouse: 'ClickHouse',
  cuda: 'CUDA',
  dspy: 'DSPy',
  django: 'Django',
  scikit_learn: 'scikit-learn',
  other: 'Other',
});

/**
 * @param {string | null | undefined} topic
 * @returns {string}
 */
export function topicLabel(topic) {
  if (!topic) return 'Other';
  const known = /** @type {Record<string, string>} */ (TOPIC_LABELS)[topic];
  if (known) return known;
  const s = topic.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Dossier stepper (section 2.3)
// ---------------------------------------------------------------------------

export const STEPS = Object.freeze([
  { id: 'cv_built', label: 'CV built' },
  { id: 'sent', label: 'Sent' },
  { id: 'first_reply', label: 'First reply' },
  { id: 'interviews', label: 'Interviews' },
  { id: 'outcome', label: 'Outcome' },
]);

// ---------------------------------------------------------------------------
// Colours (section 3.4). Token names are what globals.css defines; values are the
// computed-contrast pairs, so scripts/contrast.mjs can re-check them.
// ---------------------------------------------------------------------------

/**
 * CSS custom-property names for a phase pill: `fg` is the text and dot colour, `bg` the tint.
 * no_reply -> '--phase-no-reply-fg'.
 * @param {string} phase
 * @returns {{ fg: string, bg: string }}
 */
export function phaseTokens(phase) {
  const k = String(phase).replace(/_/g, '-');
  return { fg: `--phase-${k}-fg`, bg: `--phase-${k}-bg` };
}

/** @type {Readonly<Record<Phase, {fg: string, bg: string}>>} */
export const PHASE_TOKENS = Object.freeze(
  /** @type {Record<Phase, {fg: string, bg: string}>} */ (Object.fromEntries(PHASES.map((p) => [p, phaseTokens(p)]))));

export const CAUTION_TOKENS = Object.freeze({ fg: '--caution-fg', bg: '--caution-bg' });

const CLOSED_COLORS = { light: { fg: '#6E695E', bg: '#EFEDE7' }, dark: { fg: '#B5B0A4', bg: '#2A2822' } };

/** @type {Readonly<Record<Phase, {light: {fg: string, bg: string}, dark: {fg: string, bg: string}}>>} */
export const PHASE_COLORS = Object.freeze({
  draft: { light: { fg: '#5B5648', bg: '#EEECE6' }, dark: { fg: '#C9C4B8', bg: '#2A2822' } },
  applied: { light: { fg: '#2F4FA8', bg: '#E8EDFA' }, dark: { fg: '#A9BDF5', bg: '#1E2740' } },
  screening: { light: { fg: '#5B3A9A', bg: '#EFE9F8' }, dark: { fg: '#C9B3F0', bg: '#2B2340' } },
  interviewing: { light: { fg: '#1A6B6B', bg: '#E3F0EE' }, dark: { fg: '#7FD0C6', bg: '#16302E' } },
  offer: { light: { fg: '#2E6B1F', bg: '#E6F2DF' }, dark: { fg: '#9BD68A', bg: '#1D2E18' } },
  rejected: { light: { fg: '#A3302A', bg: '#F8E6E4' }, dark: { fg: '#F2A49D', bg: '#3A1F1C' } },
  no_reply: CLOSED_COLORS,
  withdrawn: CLOSED_COLORS,
  skipped: CLOSED_COLORS,
});

export const CAUTION_COLORS = Object.freeze({ light: { fg: '#8A5A00', bg: '#FBF0D9' }, dark: { fg: '#F0C46A', bg: '#3A2E12' } });
