// "From application to offer" on /home: how many applications it takes to get an interview, and the
// pass rate at each stage after that.
//
//   ladder   Sent → 1st interview → 2nd interview → … → Offer, with how many reached each stage
//   steps    for each stage: how many went on, how many stopped there, how many are still waiting
//
// A stage is reached when you were invited to it, even if the date is still ahead. A stage is passed
// when the next one (or an offer) followed, and failed when the application was rejected or went
// quiet past the no-reply line, at any stage (a process that stops answering after an interview has
// stopped too). Applications still waiting, and ones you withdrew from, stay out of
// the rates until they have an outcome, so a young search does not look worse than it is. Every rate
// leads with a percentage, at any sample size, as the owner asked (an exception to spec 5.2): the count
// stays beside it, the likely range joins it from 20 outcomes, and below 20 a note says it can still move.

import { daysBetween, formatShort, toDateOnly } from './dates.mjs';
import { isOpen } from './phases.mjs';
import { INTERVIEW_TYPES, interviewRounds, lowerFirst } from './interviews.mjs';
import { joinNames } from './home.mjs';
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

const INTERVIEW_KINDS = new Set(['interview_scheduled', 'interview_done']);

/** The latest date in a list, or null. @param {Array<string | null | undefined>} dates */
const latest = (dates) => dates.filter((x) => !!x).sort().at(-1) ?? null;

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
  const roundList = interviewRounds(d, today);
  const days = roundList.map((r) => r.on);
  let rounds = days.length;
  let logged = true;
  // An offer made by a status change, then declined, is still an offer.
  const offered = d.offered || d.events.some((e) => e.kind === 'phase_change' && e.to_phase === 'offer');
  // With interviews in its History, the History decides; only without any does a status say so.
  if (rounds === 0 && (d.interviewed || offered) && !d.events.some((e) => INTERVIEW_KINDS.has(e.kind))) {
    rounds = 1;
    logged = false;
  }
  // Quiet since the last thing that happened: sending, an answer, a follow-up, an interview or a change
  // of status. With no date at all, since the row was made.
  const moves = d.events.filter((e) => e.kind === 'phase_change').map((e) => dayOf(e) ?? '');
  const lastSign = latest([d.silenceBase, ...[...days, ...moves].filter((x) => x <= today)]) ?? d.windowDate;
  const quietDays = lastSign ? daysBetween(lastSign, today) : null;
  /** @type {'offer' | 'out' | 'withdrawn' | 'waiting'} */
  let outcome = 'waiting';
  if (offered) outcome = 'offer';
  else if (d.phase === 'withdrawn') outcome = 'withdrawn';
  else if (!isOpen(d.phase)) outcome = 'out';
  else if (!d.nextInterviewOn && quietDays !== null && quietDays >= noReplyAfter) outcome = 'out';
  return { rounds, logged, outcome, roundList };
}

/**
 * One step of the ladder: of the applications that reached a stage, how many reached the next.
 * @param {Array<ReturnType<typeof journeyOf>>} at  the applications counted at this stage
 * @param {(j: ReturnType<typeof journeyOf>) => boolean} passed
 * @param {(j: ReturnType<typeof journeyOf>) => boolean} [straight]  passed by going to an offer with no further round
 */
function stepOf(at, passed, straight = () => false) {
  const went = at.filter(passed);
  const rest = at.filter((j) => !passed(j));
  const stopped = rest.filter((j) => j.outcome === 'out').length;
  const waiting = rest.filter((j) => j.outcome === 'waiting').length;
  const withdrew = rest.filter((j) => j.outcome === 'withdrawn').length;
  const decided = went.length + stopped;
  return {
    passed: went.length,
    /** Of those that went on, how many went straight to an offer. */
    offers: went.filter(straight).length,
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

/**
 * "3 are still waiting for an outcome; they count once they have one or go quiet past your no-reply
 * line (45 days). You withdrew from 1."
 * @param {{ waiting: number, withdrew: number }} s
 * @param {number} noReplyAfter
 */
function asideOf(s, noReplyAfter) {
  const parts = [];
  if (s.waiting) {
    parts.push(s.waiting === 1
      ? `1 is still waiting for an outcome; it counts once it has one or goes quiet past your no-reply line (${noReplyAfter} days).`
      : `${s.waiting} are still waiting for an outcome; they count once they have one or go quiet past your no-reply line (${noReplyAfter} days).`);
  }
  if (s.withdrew) parts.push(`You withdrew from ${s.withdrew}.`);
  return parts.length ? parts.join(' ') : null;
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
  const olderSent = older.filter((d) => d.sent).length;
  const base = windowMode === 'all' ? ctx.all : inWindow;
  const sent = base.filter((d) => d.sent);
  const noReplyAfter = settings.no_reply_after_days;
  const journeys = sent.map((d) => journeyOf(d, { today, noReplyAfter }));

  // ── scope ─────────────────────────────────────────────────────────────────
  const since = formatShort(settings.campaign_start, { withYear: true });
  const records = `${olderSent} older sent ${plural(olderSent, 'application', 'applications')} from before ${since}`;
  let note = null;
  if (olderSent) {
    note = windowMode === 'campaign'
      ? `${records} ${plural(olderSent, "isn't", "aren't")} counted here.`
      : `Includes ${records}. ${olderSent === 1 ? 'It is' : 'They are'} incomplete, so the rates may look better than they were.`;
  }
  const unconfirmed = sent.filter((d) => d.unconfirmed).length;

  // ── the ladder ────────────────────────────────────────────────────────────
  const deepest = Math.max(1, ...journeys.map((j) => j.rounds));
  const roundStages = Math.min(deepest, MAX_ROUND_STAGES);
  const reached = (/** @type {ReturnType<typeof journeyOf>} */ j, /** @type {number} */ k) => j.rounds >= k;
  // Past the first interview only rounds in the History can be placed, whatever the outcome.
  const counted = (/** @type {ReturnType<typeof journeyOf>} */ j) => j.logged;

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
      const next = (/** @type {ReturnType<typeof journeyOf>} */ j) => !last && reached(j, k + 1);
      return {
        from: `round${k}`,
        to: last ? 'offer' : `round${k + 1}`,
        ...stepOf(at, (j) => j.outcome === 'offer' || next(j), (j) => j.outcome === 'offer' && !next(j)),
      };
    }),
  ];
  const unlogged = journeys.filter((j) => j.rounds > 0 && !counted(j)).length;

  // ── by kind of interview ──────────────────────────────────────────────────
  // Each round is passed when another round or an offer followed it. The last round shares the
  // application's outcome: stopped there, still waiting, or withdrawn.
  /** @type {Map<string, { passed: number, stopped: number, waiting: number, withdrew: number }>} */
  const tally = new Map();
  let untyped = 0;
  for (const j of journeys) {
    j.roundList.forEach((r, i) => {
      if (!r.type) {
        untyped += 1;
        return;
      }
      const t = tally.get(r.type) ?? { passed: 0, stopped: 0, waiting: 0, withdrew: 0 };
      const last = i === j.roundList.length - 1;
      if (!last || j.outcome === 'offer') t.passed += 1;
      else if (j.outcome === 'out') t.stopped += 1;
      else if (j.outcome === 'waiting') t.waiting += 1;
      else t.withdrew += 1;
      tally.set(r.type, t);
    });
  }
  const byType = INTERVIEW_TYPES.filter((t) => tally.has(t.id)).map((t) => {
    const c = /** @type {{ passed: number, stopped: number, waiting: number, withdrew: number }} */ (tally.get(t.id));
    const decided = c.passed + c.stopped;
    return {
      id: t.id,
      label: t.label,
      ...c,
      decided,
      percent: decided ? formatPercent(c.passed / decided) : null,
      small: decided > 0 && decided < SMALL_SAMPLE,
    };
  });
  // The weakest kinds, once two kinds have outcomes and some do worse than the rest: fewer passed, as a share.
  const share = (/** @type {{ passed: number, decided: number }} */ t) => t.passed / t.decided;
  const judged = byType.filter((t) => t.decided > 0);
  const lowest = Math.min(...judged.map(share));
  const weakest = judged.length >= 2 && judged.some((t) => share(t) > lowest) ? judged.filter((t) => share(t) === lowest) : [];

  // ── the two answers ───────────────────────────────────────────────────────
  const first = steps[0];
  const answered = `${first.passed} of ${first.decided} ${plural(first.decided, 'application', 'applications')} with an outcome`;
  const perOne = (/** @type {number} */ decided, /** @type {number} */ passed, /** @type {string} */ one, /** @type {string} */ many) => {
    const n = average(decided / passed);
    return `about ${n} ${n === '1' ? one : many}`;
  };
  const perInterview = {
    ...first,
    value: first.percent ?? '–',
    unit: first.decided ? 'of applications led to an interview' : null,
    answer: !journeys.length
      ? 'Nothing sent yet.'
      : !first.decided
        ? 'No application has an outcome yet.'
        : `${answered}${first.passed ? `: ${perOne(first.decided, first.passed, 'application', 'applications')} for each interview` : ''}.${rangeOf(first)}`,
    aside: asideOf(first, noReplyAfter),
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
        ? 'No interview process has an outcome yet.'
        : `${toOffer.passed} of ${toOffer.decided} ${plural(toOffer.decided, 'interview process', 'interview processes')} with an outcome${toOffer.passed ? `: ${perOne(toOffer.decided, toOffer.passed, 'process', 'processes')} for each offer` : ''}.${rangeOf(toOffer)}`,
    aside: asideOf(toOffer, noReplyAfter),
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
    smallNote: [perInterview, perOffer, ...steps, ...byType].some((s) => s.small)
      ? `A percentage from fewer than ${SMALL_SAMPLE} outcomes can still move a lot with the next one.`
      : null,
    byType,
    byTypeLine: weakest.length === 1
      ? `So far the ${lowerFirst(weakest[0].label)} stops you most: ${weakest[0].passed} of ${weakest[0].decided} went further.`
      : weakest.length
        ? `So far ${joinNames(weakest.map((t) => `the ${lowerFirst(t.label)}`))} stop you most.`
        : byType.length
        ? 'No kind of interview stands out yet.'
        : null,
    untyped,
    untypedNote: untyped
      ? `${untyped} ${plural(untyped, 'interview has', 'interviews have')} no kind yet. Pick one when you log an interview, and it counts here.`
      : null,
    unloggedNote: unlogged
      ? `${unlogged} ${plural(unlogged, 'application reached', 'applications reached')} an interview with no round in ${plural(unlogged, 'its', 'their')} History, so the steps after the first interview leave ${plural(unlogged, 'it', 'them')} out. "Getting an offer" still counts ${plural(unlogged, 'its', 'their')} outcome.`
      : null,
    howCounted: `An application reaches a stage once you are invited to it, even if the date is still ahead. It passed when the next round or an offer followed, and stopped when it was rejected or went quiet past your no-reply line (${noReplyAfter} days) with nothing booked. Applications still waiting, and ones you withdrew from, are left out until they have an outcome. Each booked or logged interview in the History is one round.`,
  };
}
