// "From application to offer" on /home: how many applications it takes to get an interview, and the
// pass rate at each stage after that.
//
//   ladder   Sent → 1st interview → 2nd interview → … → Offer, with how many reached each stage
//   steps    for each stage: how many went on, how many stopped there, how many are still waiting
//
// A stage is reached when you were invited to it, even if the date is still ahead. A stage is passed
// when the next one (or an offer) followed, and failed when the application was rejected or went
// silent past the no-reply line. Applications still waiting, and ones you withdrew from, stay out of
// the rates until they have an outcome, so a young search does not look worse than it is. Every rate
// leads with a percentage, at any sample size, as the owner asked (an exception to spec 5.2): the count
// stays beside it, the likely range joins it from 20 outcomes, and below 20 a note says it can still move.

import { formatShort, toDateOnly } from './dates.mjs';
import { isOpen } from './phases.mjs';
import { buildContext } from './derive.mjs';
import { describeRate, formatPercent } from './stats.mjs';

/** Rounds past this one fold into "4th interview or later". */
export const MAX_ROUND_STAGES = 4;

const ORDINALS = ['1st', '2nd', '3rd', '4th'];

/** Below this many outcomes a percentage can still move a lot, and says so. */
const SMALL_SAMPLE = 20;

/**
 * @param {number} n
 * @param {string} one
 * @param {string} many
 */
function plural(n, one, many) {
  return n === 1 ? one : many;
}

/** @param {any} e */
const dayOf = (e) => toDateOnly(e.occurred_on);

/**
 * How many interview rounds an application was invited to. A booking is a round; "interview done"
 * closes the booking before it, and is a round of its own only when no booking is open (an interview
 * logged after the fact). A closed application counts only rounds up to today: a booking still ahead
 * on it never took place.
 * @param {import('./derive.mjs').Derived} d
 * @param {string} today
 */
function roundsOf(d, today) {
  const open = isOpen(d.phase);
  const rank = (/** @type {any} */ e) => (e.kind === 'interview_scheduled' ? 0 : 1);
  const events = d.events
    .filter((e) => e.kind === 'interview_scheduled' || e.kind === 'interview_done')
    .filter((e) => open || (dayOf(e) ?? '9999') <= today)
    .sort((x, y) => String(dayOf(x)).localeCompare(String(dayOf(y))) || rank(x) - rank(y));
  let rounds = 0;
  let booked = 0;
  for (const e of events) {
    if (e.kind === 'interview_scheduled') {
      rounds += 1;
      booked += 1;
    } else if (booked > 0) booked -= 1;
    else rounds += 1;
  }
  return rounds;
}

/**
 * Where one sent application got to.
 *   rounds   interview rounds it was invited to
 *   logged   false when it reached an interview but no round is in its History (a status change or an
 *            old tracker stage says so): it counts up to the first interview and no further
 *   outcome  offer | out (rejected, or silent past the no-reply line) | withdrawn | waiting
 * @param {import('./derive.mjs').Derived} d
 * @param {{ today: string, noReplyAfter: number }} ctx
 */
function journeyOf(d, { today, noReplyAfter }) {
  let rounds = roundsOf(d, today);
  let logged = true;
  if (rounds === 0 && (d.interviewed || d.offered)) {
    rounds = 1;
    logged = false;
  }
  /** @type {'offer' | 'out' | 'withdrawn' | 'waiting'} */
  let outcome = 'waiting';
  if (d.offered) outcome = 'offer';
  else if (d.phase === 'withdrawn') outcome = 'withdrawn';
  else if (!isOpen(d.phase)) outcome = 'out';
  else if (rounds === 0 && !d.responded && d.silenceDays !== null && d.silenceDays >= noReplyAfter) outcome = 'out';
  return { rounds, logged, outcome };
}

/**
 * One step of the ladder: of the applications that reached a stage, how many reached the next.
 * @param {Array<ReturnType<typeof journeyOf>>} at  the applications counted at this stage
 * @param {(j: ReturnType<typeof journeyOf>) => boolean} passed
 */
function stepOf(at, passed) {
  const went = at.filter(passed);
  const rest = at.filter((j) => !passed(j));
  const stopped = rest.filter((j) => j.outcome === 'out').length;
  const waiting = rest.filter((j) => j.outcome === 'waiting').length;
  const withdrew = rest.filter((j) => j.outcome === 'withdrawn').length;
  const decided = went.length + stopped;
  return {
    passed: went.length,
    stopped,
    waiting,
    withdrew,
    decided,
    percent: decided ? formatPercent(went.length / decided) : null,
    small: decided > 0 && decided < SMALL_SAMPLE,
    rate: decided ? describeRate(went.length, decided) : null,
  };
}

/** 3.3, 12: one decimal while it matters. @param {number} x */
const average = (x) => (x < 10 ? String(Math.round(x * 10) / 10) : String(Math.round(x)));

/** " Likely between 22% and 40%.", once the sample gives a range. @param {ReturnType<typeof stepOf>} s */
const rangeOf = (s) => (s.rate?.rangeText ? ` ${s.rate.rangeText[0].toUpperCase()}${s.rate.rangeText.slice(1)}.` : '');

/** "8 are still waiting to hear, and you withdrew from 1." @param {{ waiting: number, withdrew: number }} s @param {string} waitingFor */
function asideOf(s, waitingFor) {
  const parts = [];
  if (s.waiting) parts.push(`${s.waiting} ${plural(s.waiting, 'is', 'are')} still waiting ${waitingFor}`);
  if (s.withdrew) parts.push(`you withdrew from ${s.withdrew}`);
  if (!parts.length) return null;
  const text = parts.join(', and ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}

/**
 * @param {import('./derive.mjs').CoreInput} input
 * @param {{ window?: 'campaign' | 'all' }} [opts]
 */
export function computeAnalytics(input, opts = {}) {
  const windowMode = opts.window === 'all' ? 'all' : 'campaign';
  const ctx = buildContext(input);
  const { settings, today } = ctx;
  const inWindow = ctx.all.filter((d) => d.inWindow);
  const older = ctx.all.filter((d) => !d.inWindow);
  const base = windowMode === 'all' ? ctx.all : inWindow;
  const sent = base.filter((d) => d.sent);
  const noReplyAfter = settings.no_reply_after_days;
  const journeys = sent.map((d) => journeyOf(d, { today, noReplyAfter }));

  // ── scope ─────────────────────────────────────────────────────────────────
  const since = formatShort(settings.campaign_start, { withYear: true });
  const records = `${older.length} older ${plural(older.length, 'record', 'records')} from before ${since}`;
  let note = null;
  if (older.length) {
    note = windowMode === 'campaign'
      ? `${records} ${plural(older.length, "isn't", "aren't")} counted here.`
      : `Includes ${records}. ${older.length === 1 ? 'It is' : 'They are'} incomplete, so the rates may look better than they were.`;
  }
  const unconfirmed = sent.filter((d) => d.unconfirmed).length;

  // ── the ladder ────────────────────────────────────────────────────────────
  const deepest = Math.max(1, ...journeys.map((j) => j.rounds));
  const roundStages = Math.min(deepest, MAX_ROUND_STAGES);
  const reached = (/** @type {ReturnType<typeof journeyOf>} */ j, /** @type {number} */ k) => j.rounds >= k;
  // Past the first interview only rounds in the History count. An offer is an outcome either way.
  const counted = (/** @type {ReturnType<typeof journeyOf>} */ j) => j.logged || j.outcome === 'offer';

  const roundLabel = (/** @type {number} */ k) => (k === roundStages && deepest > MAX_ROUND_STAGES ? `${ORDINALS[k - 1]} interview or later` : `${ORDINALS[k - 1]} interview`);
  const stages = [
    { id: 'sent', label: 'Sent', count: journeys.length },
    ...Array.from({ length: roundStages }, (_, i) => ({ id: `round${i + 1}`, label: roundLabel(i + 1), count: journeys.filter((j) => reached(j, i + 1)).length })),
    { id: 'offer', label: 'Offer', count: journeys.filter((j) => j.outcome === 'offer').length },
  ];

  const steps = [
    { from: 'sent', to: 'round1', ...stepOf(journeys, (j) => reached(j, 1)) },
    ...Array.from({ length: roundStages }, (_, i) => {
      const k = i + 1;
      const at = journeys.filter((j) => reached(j, k) && counted(j));
      const last = k === roundStages;
      // Went on: to another round, or straight to an offer.
      return { from: `round${k}`, to: last ? 'offer' : `round${k + 1}`, ...stepOf(at, (j) => j.outcome === 'offer' || (!last && reached(j, k + 1))) };
    }),
  ];
  const unlogged = journeys.filter((j) => j.rounds > 0 && !counted(j)).length;

  // ── the two answers ───────────────────────────────────────────────────────
  const first = steps[0];
  const answered = `${first.passed} of ${first.decided} ${plural(first.decided, 'application', 'applications')} with an answer`;
  const perInterview = {
    ...first,
    value: first.percent ?? '–',
    unit: first.decided ? 'of applications led to an interview' : null,
    answer: !journeys.length
      ? 'Nothing sent yet.'
      : !first.decided
        ? 'No application has an answer yet.'
        : `${answered}${first.passed ? `: about ${average(first.decided / first.passed)} applications for each interview` : ''}.${rangeOf(first)}`,
    aside: asideOf(first, `to hear, and count once they have an answer or pass your no-reply line (${noReplyAfter} days)`),
  };

  const interviewed = journeys.filter((j) => j.rounds > 0);
  const toOffer = stepOf(interviewed, (j) => j.outcome === 'offer');
  const perOffer = {
    ...toOffer,
    value: toOffer.percent ?? '–',
    unit: toOffer.decided ? 'of interview processes ended in an offer' : null,
    answer: !interviewed.length
      ? 'No interview yet.'
      : !toOffer.decided
        ? `${interviewed.length} ${plural(interviewed.length, 'interview process is', 'interview processes are')} still going.`
        : `${toOffer.passed} of ${toOffer.decided} ${plural(toOffer.decided, 'interview process', 'interview processes')} with an outcome${toOffer.passed ? `: about ${average(toOffer.decided / toOffer.passed)} for each offer` : ''}.${rangeOf(toOffer)}`,
    aside: asideOf(toOffer, 'for an outcome'),
  };

  return {
    today,
    window: windowMode,
    hasData: base.length > 0,
    scope: {
      campaign: inWindow.length,
      all: ctx.all.length,
      older: older.length,
      since,
      note,
      unconfirmed,
      unconfirmedNote: unconfirmed
        ? `${unconfirmed} sent ${plural(unconfirmed, 'application has', 'applications have')} details still to confirm.`
        : null,
    },
    intro: journeys.length ? `Based on ${journeys.length} sent ${plural(journeys.length, 'application', 'applications')}.` : null,
    perInterview,
    perOffer,
    stages,
    steps,
    unlogged,
    smallNote: [perInterview, perOffer, ...steps].some((s) => s.small)
      ? `A percentage from fewer than ${SMALL_SAMPLE} outcomes can still move a lot with the next one.`
      : null,
    unloggedNote: unlogged
      ? `${unlogged} ${plural(unlogged, 'application reached', 'applications reached')} an interview with no round in ${plural(unlogged, 'its', 'their')} History, so ${plural(unlogged, 'it counts', 'they count')} up to the first interview only.`
      : null,
    howCounted: `An application reaches a stage once you are invited to it, even if the date is still ahead. It passed when the next round or an offer followed, and stopped when it was rejected or went silent past your no-reply line (${noReplyAfter} days). Applications still waiting, and ones you withdrew from, are left out until they have an outcome. Each booked or logged interview in the History is one round.`,
  };
}
