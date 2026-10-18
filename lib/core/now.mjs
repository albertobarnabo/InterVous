// The "now" sentence (section 2.2): one deterministic sentence saying where an application stands.
// Also the dossier stepper (section 2.3) and the age bar value, which read the same facts.

import { daysBetween, formatShort, pluralDays, toDateOnly } from './dates.mjs';
import { phaseLabel, eventTitle, STEPS, CLOSED_PHASES } from './phases.mjs';
import { deriveApp, resolveSettings, sortEvents } from './derive.mjs';

/**
 * @param {number} n
 * @returns {string}
 */
function ago(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  return `${pluralDays(n)} ago`;
}

/**
 * Date the application entered `phase`: the newest event whose to_phase is that phase
 * (a phase_change, or an event the trigger mapped). null when unknown (e.g. legacy rows).
 * @param {string} phase
 * @param {any[]} events
 * @returns {string | null}
 */
export function phaseChangedOn(phase, events) {
  const kindFor = /** @type {Record<string, string>} */ ({ rejected: 'rejection', offer: 'offer', withdrawn: 'withdrawn', skipped: 'skipped' });
  let best = null;
  for (const e of sortEvents(events ?? [])) {
    if (e.to_phase === phase || (!e.to_phase && kindFor[phase] === e.kind)) best = toDateOnly(e.occurred_on);
  }
  return best;
}

/**
 * @param {any} appOrDerived job_overview row, or the Derived object from derive.mjs
 * @param {{ events?: any[] | null, today: string, settings?: any, contacts?: any[] }} ctx
 */
function asDerived(appOrDerived, ctx) {
  if (appOrDerived && appOrDerived.app && 'inWindow' in appOrDerived) return appOrDerived;
  const settings = resolveSettings(ctx.settings);
  return deriveApp(appOrDerived, {
    settings, today: ctx.today,
    events: ctx.events === undefined ? null : (ctx.events ?? []).filter((e) => String(e.job_id) === String(appOrDerived.id)),
    contacts: ctx.contacts ?? [],
  });
}

/**
 * The now sentence.
 *
 * | draft                         | "CV built {n} days ago. Not sent." (+ " The posting is gone." when posting_live = false) |
 * | applied/screening, no reply   | "Sent {n} days ago. No reply yet." / n >= no_reply_after_days: "No reply after {n} days." / no date: "Sent, date unknown." |
 * | applied/screening, replied    | "Sent {date}. They replied {date}." |
 * | interviewing                  | "{last event title}, {date}." / last event > 14 days old: "Nothing logged since {date}." |
 * | offer/rejected/no_reply/withdrawn | "{Phase label} on {date of the phase change}." |
 * | skipped                       | "Decided not to apply." |
 *
 * @param {any} app job_overview row (or a Derived)
 * @param {{ today: string, events?: any[] | null, settings?: any }} ctx  pass all events (they are filtered by job_id)
 * @returns {string}
 */
export function nowSentence(app, ctx) {
  const d = asDerived(app, ctx);
  const settings = resolveSettings(ctx.settings);
  const today = ctx.today;
  const fmt = (/** @type {string | null} */ x) => formatShort(x, { today });
  const row = d.app;

  switch (d.phase) {
    case 'draft': {
      const gone = row.posting_live === false ? ' The posting is gone.' : '';
      if (d.draftAgeDays === null) return `Not sent.${gone}`;
      return `CV built ${ago(d.draftAgeDays)}. Not sent.${gone}`;
    }
    case 'applied':
    case 'screening': {
      if (!d.appliedOn) return d.responded ? 'Sent, date unknown. They replied.' : 'Sent, date unknown.';
      if (d.responded) {
        return d.responseOn ? `Sent ${fmt(d.appliedOn)}. They replied ${fmt(d.responseOn)}.` : `Sent ${fmt(d.appliedOn)}. They replied.`;
      }
      const n = /** @type {number} */ (d.daysSinceApplied);
      if (n >= settings.no_reply_after_days) return `No reply after ${pluralDays(n)}.`;
      return `Sent ${ago(n)}. No reply yet.`;
    }
    case 'interviewing': {
      if (!d.lastEventOn) return 'Interviewing. Nothing logged yet.';
      const age = /** @type {number} */ (daysBetween(d.lastEventOn, today));
      if (age > 14) return `Nothing logged since ${fmt(d.lastEventOn)}.`;
      const title = d.lastEvent ? eventTitle(d.lastEvent) : 'Last update';
      return `${title}, ${fmt(d.lastEventOn)}.`;
    }
    case 'skipped':
      return 'Decided not to apply.';
    default: {
      const on = phaseChangedOn(d.phase, d.events);
      return on ? `${phaseLabel(d.phase)} on ${fmt(on)}.` : `${phaseLabel(d.phase)}, date unknown.`;
    }
  }
}

/**
 * Value for the list's age bar: days waiting since the last of applied / last reply / follow-up,
 * for applied and screening rows only. null otherwise or when undated.
 * @param {any} app
 * @param {{ today: string, events?: any[] | null, settings?: any }} ctx
 * @returns {number | null}
 */
export function waitingDays(app, ctx) {
  const d = asDerived(app, ctx);
  if (d.phase !== 'applied' && d.phase !== 'screening') return null;
  return d.silenceDays;
}

/**
 * @typedef {object} Stepper
 * @property {Array<{ id: string, label: string, date: string | null, reached: boolean, current: boolean, note?: string }>} steps
 * @property {Array<{ from: string, to: string, days: number }>} gaps  day counts between consecutive dated steps
 * @property {number} currentIndex
 */

/**
 * Dossier stepper: CV built -> Sent -> First reply -> Interviews -> Outcome.
 * @param {any} app
 * @param {{ today: string, events?: any[] | null, settings?: any }} ctx
 * @returns {Stepper}
 */
export function buildStepper(app, ctx) {
  const d = asDerived(app, ctx);
  const firstInvite = d.events.find((/** @type {any} */ e) => e.kind === 'interview_scheduled');
  const closed = /** @type {readonly string[]} */ (CLOSED_PHASES).includes(d.phase) || d.phase === 'offer';
  const outcomeOn = closed ? phaseChangedOn(d.phase, d.events) : null;
  const reached = {
    cv_built: d.cvBuiltOn !== null || d.phase !== 'draft',
    sent: d.sent,
    first_reply: d.responded,
    interviews: d.interviewed,
    outcome: closed,
  };
  const dates = {
    cv_built: d.cvBuiltOn,
    sent: d.appliedOn,
    first_reply: d.responseOn,
    interviews: firstInvite ? toDateOnly(firstInvite.occurred_on) : null,
    outcome: outcomeOn,
  };
  let currentIndex = 0;
  STEPS.forEach((s, i) => { if (reached[/** @type {keyof typeof reached} */ (s.id)]) currentIndex = i; });
  const steps = STEPS.map((s, i) => {
    const id = /** @type {keyof typeof reached} */ (s.id);
    /** @type {{ id: string, label: string, date: string | null, reached: boolean, current: boolean, note?: string }} */
    const step = { id: s.id, label: s.label, date: dates[id], reached: reached[id], current: i === currentIndex };
    if (id === 'outcome' && closed) step.label = phaseLabel(d.phase);
    if (d.phase === 'skipped' && id === 'outcome') step.note = 'Decided not to apply';
    return step;
  });
  /** @type {Array<{ from: string, to: string, days: number }>} */
  const gaps = [];
  for (let i = 0; i + 1 < steps.length; i++) {
    const a = steps[i], b = steps[i + 1];
    if (a.date && b.date) gaps.push({ from: a.id, to: b.id, days: /** @type {number} */ (daysBetween(a.date, b.date)) });
  }
  return { steps, gaps, currentIndex };
}
