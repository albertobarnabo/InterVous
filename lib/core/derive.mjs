// Shared definitions (section 5.1), computed once per application and used by now.mjs,
// today.mjs and insights.mjs.
//
// Input rows are job_overview rows. The view already carries first_response_on, last_inbound_on,
// last_follow_up_on, last_event_on and next_interview_at. When the `events` input holds events for a
// job, those values are recomputed from the events (so an optimistic UI update counts at once);
// for a job with no events in the input, the view's columns are used. Either way the result is
// filtered against `today`, so a future-dated event never counts as a reply.

import { toDateOnly, daysBetween, maxDate, todayIn, DEFAULT_TIMEZONE } from './dates.mjs';
import { isSent, RESPONDED_PHASES, INTERVIEW_STAGES, defaultDirection, phaseGroup } from './phases.mjs';
import { appRef } from './slug.mjs';

/** Defaults of the user_settings row. */
export const DEFAULT_SETTINGS = Object.freeze({
  follow_up_after_days: 14,
  no_reply_after_days: 45,
  mature_after_days: 21,
  draft_stale_after_days: 7,
  weekly_target: 3,
  timezone: DEFAULT_TIMEZONE,
  campaign_start: '2026-08-01',
});

/**
 * user_settings row merged over the defaults (missing or null fields fall back).
 * @param {Partial<typeof DEFAULT_SETTINGS> | null | undefined} settings
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function resolveSettings(settings) {
  /** @type {any} */
  const out = { ...DEFAULT_SETTINGS };
  if (settings) {
    for (const [k, v] of Object.entries(settings)) if (v !== null && v !== undefined && k in DEFAULT_SETTINGS) out[k] = v;
  }
  out.campaign_start = toDateOnly(out.campaign_start) ?? DEFAULT_SETTINGS.campaign_start;
  return out;
}

/**
 * @template T
 * @param {T[] | null | undefined} rows
 * @param {(row: T) => string | number | null | undefined} key
 * @returns {Map<string, T[]>}
 */
export function groupRows(rows, key) {
  /** @type {Map<string, T[]>} */
  const m = new Map();
  for (const r of rows ?? []) {
    const k = key(r);
    if (k === null || k === undefined) continue;
    const ks = String(k);
    const list = m.get(ks);
    if (list) list.push(r); else m.set(ks, [r]);
  }
  return m;
}

/**
 * @param {any} e
 * @returns {string}
 */
function eventDirection(e) {
  return e.direction ?? defaultDirection(e.kind);
}

/**
 * Events of one job, oldest first (occurred_on, then occurred_at, then id).
 * @param {any[]} events
 * @returns {any[]}
 */
export function sortEvents(events) {
  return [...events].sort((a, b) => {
    const da = toDateOnly(a.occurred_on) ?? '', db = toDateOnly(b.occurred_on) ?? '';
    if (da !== db) return da < db ? -1 : 1;
    const ta = a.occurred_at ?? '', tb = b.occurred_at ?? '';
    if (ta !== tb) return ta < tb ? -1 : 1;
    return Number(a.id ?? 0) - Number(b.id ?? 0);
  });
}

/**
 * @typedef {object} Derived
 * @property {any} app               The input job_overview row, untouched.
 * @property {number} id
 * @property {string | null} slug
 * @property {string} ref            slug, or the id for legacy rows
 * @property {string} company
 * @property {string} role
 * @property {string} phase
 * @property {string[]} uncertain
 * @property {boolean} unconfirmed   uncertain is not empty
 * @property {boolean} statusUnconfirmed 'phase' is in uncertain (was it really sent?)
 * @property {string | null} windowDate coalesce(applied_on, cv_built_on, created_at::date)
 * @property {boolean} inWindow      windowDate >= campaign_start
 * @property {boolean} sent
 * @property {boolean} dated         sent and applied_on is set
 * @property {string | null} appliedOn
 * @property {string | null} cvBuiltOn
 * @property {number | null} daysSinceApplied
 * @property {number | null} draftAgeDays today - cv_built_on (any phase)
 * @property {string | null} responseOn first inbound non-auto_ack event on or before today
 * @property {boolean} responded     responseOn set, or phase screening / interviewing / offer / rejected
 * @property {number | null} responseDays responseOn - appliedOn
 * @property {boolean} mature        old enough to judge: dated and (age >= mature_after_days or responded)
 * @property {string | null} lastInboundOn
 * @property {string | null} lastFollowUpOn
 * @property {string | null} lastEventOn latest non-phase_change event on or before today
 * @property {any | null} lastEvent   that event's row, when events were given
 * @property {string | null} silenceBase max(applied_on, last_inbound_on, last_follow_up_on)
 * @property {number | null} silenceDays today - silenceBase
 * @property {boolean} interviewed   interview_scheduled event, phase interviewing/offer, or a legacy interview stage
 * @property {boolean} offered       phase offer or an offer event
 * @property {string | null} lastInviteOn latest interview_scheduled event on or before today
 * @property {string | null} nextInterviewOn earliest interview date >= today
 * @property {string | null} nextInterviewAt its timestamp, when one is known
 * @property {boolean} hasContact
 * @property {number} contactCount
 * @property {any[]} events           this job's events, oldest first ([] when none were given)
 */

/**
 * @param {any} app
 * @param {{ settings: typeof DEFAULT_SETTINGS, today: string, events: any[] | null, contacts: any[] | null }} ctx
 * @returns {Derived}
 */
export function deriveApp(app, ctx) {
  const { settings, today } = ctx;
  const tz = settings.timezone;
  const events = ctx.events ? sortEvents(ctx.events) : [];
  const useEvents = events.length > 0;
  const phase = app.phase ?? 'applied';
  const uncertain = Array.isArray(app.uncertain) ? app.uncertain.filter(Boolean) : [];
  const appliedOn = toDateOnly(app.applied_on);
  const cvBuiltOn = toDateOnly(app.cv_built_on);
  const windowDate = appliedOn ?? cvBuiltOn ?? toDateOnly(app.created_at, 'UTC');
  const sent = isSent(phase);

  const pastEvents = events.filter((e) => (toDateOnly(e.occurred_on) ?? '9999') <= today);
  const inbound = pastEvents.filter((e) => eventDirection(e) === 'in' && e.kind !== 'auto_ack');

  /** @type {string | null} */
  let responseOn;
  if (!useEvents) {
    const v = toDateOnly(app.first_response_on);
    responseOn = v && v <= today ? v : null;
  } else {
    responseOn = inbound.length ? toDateOnly(inbound[0].occurred_on) : null;
  }

  /** @type {string | null} */
  let lastInboundOn;
  if (!useEvents) {
    const v = toDateOnly(app.last_inbound_on);
    lastInboundOn = v && v <= today ? v : null;
  } else {
    lastInboundOn = inbound.length ? toDateOnly(inbound[inbound.length - 1].occurred_on) : null;
  }

  /** @type {string | null} */
  let lastFollowUpOn;
  if (!useEvents) {
    lastFollowUpOn = toDateOnly(app.last_follow_up_on);
  } else {
    const f = events.filter((e) => e.kind === 'follow_up_sent');
    lastFollowUpOn = f.length ? toDateOnly(f[f.length - 1].occurred_on) : null;
  }

  const logged = pastEvents.filter((e) => e.kind !== 'phase_change');
  const lastEvent = logged.length ? logged[logged.length - 1] : null;
  /** @type {string | null} */
  let lastEventOn;
  if (!useEvents) {
    const v = toDateOnly(app.last_event_on);
    lastEventOn = v && v <= today ? v : null;
  } else {
    lastEventOn = lastEvent ? toDateOnly(lastEvent.occurred_on) : null;
  }

  const invites = events.filter((e) => e.kind === 'interview_scheduled');
  const pastInvites = invites.filter((e) => (toDateOnly(e.occurred_on) ?? '9999') <= today);
  const lastInviteOn = pastInvites.length ? toDateOnly(pastInvites[pastInvites.length - 1].occurred_on) : null;
  /** @type {string | null} */
  let nextInterviewOn = null;
  /** @type {string | null} */
  let nextInterviewAt = null;
  for (const e of invites) {
    const d = e.occurred_at ? toDateOnly(e.occurred_at, tz) : toDateOnly(e.occurred_on);
    if (d && d >= today && (nextInterviewOn === null || d < nextInterviewOn)) {
      nextInterviewOn = d;
      nextInterviewAt = e.occurred_at ?? null;
    }
  }
  if (!useEvents && app.next_interview_at) {
    const d = toDateOnly(app.next_interview_at, tz);
    if (d && d >= today) { nextInterviewOn = d; nextInterviewAt = app.next_interview_at; }
  }

  const responded = responseOn !== null || /** @type {readonly string[]} */ (RESPONDED_PHASES).includes(phase);
  const dated = sent && appliedOn !== null;
  const daysSinceApplied = appliedOn ? daysBetween(appliedOn, today) : null;
  const mature = dated && (responded || (daysSinceApplied !== null && daysSinceApplied >= settings.mature_after_days));
  const silenceBase = sent ? maxDate(appliedOn, lastInboundOn, lastFollowUpOn) : null;
  const silenceDays = silenceBase ? daysBetween(silenceBase, today) : null;
  const interviewed = invites.length > 0 || phase === 'interviewing' || phase === 'offer'
    || (typeof app.stage === 'string' && INTERVIEW_STAGES.includes(app.stage));
  const offered = phase === 'offer' || events.some((e) => e.kind === 'offer');
  const contacts = ctx.contacts ?? [];

  return {
    app,
    id: Number(app.id),
    slug: app.slug ?? null,
    ref: appRef(app),
    company: app.company_name ?? '',
    role: app.role ?? '',
    phase,
    uncertain,
    unconfirmed: uncertain.length > 0,
    statusUnconfirmed: uncertain.includes('phase'),
    windowDate,
    inWindow: windowDate !== null && windowDate >= settings.campaign_start,
    sent,
    dated,
    appliedOn,
    cvBuiltOn,
    daysSinceApplied,
    draftAgeDays: cvBuiltOn ? daysBetween(cvBuiltOn, today) : null,
    responseOn,
    responded,
    responseDays: responseOn && appliedOn ? daysBetween(appliedOn, responseOn) : null,
    mature,
    lastInboundOn,
    lastFollowUpOn,
    lastEventOn,
    lastEvent,
    silenceBase,
    silenceDays,
    interviewed,
    offered,
    lastInviteOn,
    nextInterviewOn,
    nextInterviewAt,
    hasContact: contacts.length > 0,
    contactCount: contacts.length,
    events,
  };
}

/**
 * @typedef {object} CoreInput
 * @property {any[]} apps                 job_overview rows (salary_* may be merged in from jobs for I10)
 * @property {any[]} [events]             job_events rows (all of them for the apps given)
 * @property {any[]} [requirements]       job_requirements rows
 * @property {any[]} [jobProofPoints]     job_proof_points rows
 * @property {any[]} [proofPoints]        proof_points rows
 * @property {any[]} [contacts]           contacts rows (Today's follow-up rule needs "a contact exists")
 * @property {any} [settings]             user_settings row (defaults fill the gaps)
 * @property {string} [today]             'YYYY-MM-DD'; defaults to today in settings.timezone
 */

/**
 * @typedef {object} Context
 * @property {typeof DEFAULT_SETTINGS} settings
 * @property {string} today
 * @property {Derived[]} all
 * @property {Map<number, Derived>} byId
 * @property {Map<string, any[]>} requirementsByJob
 * @property {Map<string, any[]>} jobProofPointsByJob
 * @property {any[]} requirements
 * @property {any[]} jobProofPoints
 * @property {any[]} proofPoints
 * @property {any[]} events
 * @property {any[]} contacts
 */

/**
 * Derive every application once.
 * @param {CoreInput} input
 * @returns {Context}
 */
export function buildContext(input) {
  const settings = resolveSettings(input.settings);
  const today = toDateOnly(input.today) ?? todayIn(settings.timezone);
  const eventsGiven = Array.isArray(input.events);
  const eventsByJob = groupRows(input.events, (e) => e.job_id);
  const contactsByJob = groupRows(input.contacts, (c) => c.job_id);
  const all = (input.apps ?? []).map((app) => deriveApp(app, {
    settings, today,
    events: eventsGiven ? (eventsByJob.get(String(app.id)) ?? []) : null,
    contacts: contactsByJob.get(String(app.id)) ?? [],
  }));
  return {
    settings,
    today,
    all,
    byId: new Map(all.map((d) => [d.id, d])),
    requirementsByJob: groupRows(input.requirements, (r) => r.job_id),
    jobProofPointsByJob: groupRows(input.jobProofPoints, (r) => r.job_id),
    requirements: input.requirements ?? [],
    jobProofPoints: input.jobProofPoints ?? [],
    proofPoints: input.proofPoints ?? [],
    events: input.events ?? [],
    contacts: input.contacts ?? [],
  };
}

/**
 * List group of an application (section 2.2): rows outside the campaign window are 'older'.
 * @param {Derived} d
 * @returns {import('./phases.mjs').ListGroupId}
 */
export function listGroupOf(d) {
  return d.inWindow ? phaseGroup(d.phase) : 'older';
}

/**
 * '3 weeks' when the day count is a whole number of weeks, else '21 days'.
 * @param {number} days
 * @returns {string}
 */
export function weeksOrDays(days) {
  if (days % 7 === 0 && days >= 14) return `${days / 7} weeks`;
  if (days === 7) return '1 week';
  return `${days} days`;
}
