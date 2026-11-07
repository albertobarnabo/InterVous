// Interviews: what kind each one was, the rounds an application had, and where a closed application
// stopped.
//
// The kind lives in the interview event's title. The app writes the kind's label ("Technical
// interview"), `intervous feedback --stage` writes the old tracker's words ("Technical Interview"),
// and older titles are read by keyword. No column holds it, so nothing needs a migration, and a title
// with no kind in it simply leaves that round untyped.

import { toDateOnly } from './dates.mjs';
import { isOpen } from './phases.mjs';

/** @typedef {'hr'|'technical'|'hiring_manager'|'case'|'behavioural'|'final'|'other'} InterviewType */

/**
 * The kinds of interview, in the order a picker shows them. `label` is what the app writes as the
 * event title, so it is also the exact match when reading one back.
 * @type {ReadonlyArray<{ id: InterviewType, label: string, short: string }>}
 */
export const INTERVIEW_TYPES = Object.freeze([
  { id: 'hr', label: 'HR interview', short: 'HR' },
  { id: 'technical', label: 'Technical interview', short: 'Technical' },
  { id: 'hiring_manager', label: 'Hiring manager interview', short: 'Hiring manager' },
  { id: 'case', label: 'Case or take-home', short: 'Case or take-home' },
  { id: 'behavioural', label: 'Behavioural interview', short: 'Behavioural' },
  { id: 'final', label: 'Final round', short: 'Final round' },
  { id: 'other', label: 'Other interview', short: 'Other' },
]);

/**
 * Keywords for titles the app did not write, checked in this order: "Final round with the hiring
 * manager" is a final round, "Technical screen" is technical, a "recruiter screen" is HR.
 * @type {ReadonlyArray<[InterviewType, RegExp]>}
 */
const KEYWORDS = [
  ['final', /\b(final|onsite|on-site|panel|loop|superday)\b/i],
  ['technical', /\b(technical|tech|coding|live[- ]coding|system design|ml design|algorithms?|whiteboard|pair programming)\b/i],
  ['case', /\b(case|take[- ]?home|assignment|presentation|homework)\b/i],
  ['hiring_manager', /\b(hiring manager|hm)\b/i],
  ['behavioural', /\b(behaviou?ral|culture|values|team fit)\b/i],
  ['hr', /\b(hr|human resources|recruiter|recruiting|talent|people team|phone screen|screening call|intro(ductory)? call)\b/i],
];

/**
 * The kind of interview a title names, or null when it names none ("Round 1 invite").
 * @param {string | null | undefined} title
 * @returns {InterviewType | null}
 */
export function interviewTypeOf(title) {
  const t = String(title ?? '').trim();
  if (!t) return null;
  const exact = INTERVIEW_TYPES.find((x) => x.label.toLowerCase() === t.toLowerCase());
  if (exact) return exact.id;
  for (const [id, re] of KEYWORDS) if (re.test(t)) return id;
  return null;
}

/** @param {InterviewType | null | undefined} id */
export function interviewTypeLabel(id) {
  return INTERVIEW_TYPES.find((x) => x.id === id)?.label ?? null;
}

/** @param {any} e */
const dayOf = (e) => toDateOnly(e.occurred_on);

/** "technical interview" from "Technical interview", but "HR interview" stays as it is. @param {string} s */
export function lowerFirst(s) {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Events that close an application, by its closed phase. */
const CLOSING_KINDS = /** @type {Record<string, string>} */ ({ rejected: 'rejection', withdrawn: 'withdrawn', skipped: 'skipped' });

/**
 * The last day anything could still happen in an application: today while it is open, else the day
 * it closed (its rejection, its withdrawal, or the status change), so that a booking which was ahead
 * when it closed never counts, however long ago that was.
 * @param {{ phase: string, events: any[] }} d
 * @param {string} today
 */
function lastLiveDay(d, today) {
  if (isOpen(d.phase)) return null;
  const closing = d.events
    .filter((e) => e.kind === CLOSING_KINDS[d.phase] || e.to_phase === d.phase)
    .map((e) => dayOf(e) ?? '')
    .filter((x) => x && x <= today)
    .sort();
  return closing.length ? closing[closing.length - 1] : today;
}

/**
 * @typedef {object} Round
 * @property {string} on            the day of the interview
 * @property {InterviewType | null} type
 */

/**
 * The interview rounds of an application, oldest first. A booking is a round, and so is an
 * "interview done" on any other day: the app books the first interview and logs the later ones as done
 * on the day they happen. On one day, the bookings and the dones pair up in order: a done on a booked
 * day is that booking, and its kind wins, since it was chosen after the interview. Two dones on one day
 * are two rounds. A closed application counts only rounds up to the day it closed.
 * @param {{ phase: string, events: any[] }} d
 * @param {string} today
 * @returns {Round[]}
 */
export function interviewRounds(d, today) {
  const until = lastLiveDay(d, today);
  /** @type {Map<string, { booked: any[], done: any[] }>} */
  const byDay = new Map();
  for (const e of d.events) {
    if (e.kind !== 'interview_scheduled' && e.kind !== 'interview_done') continue;
    const on = dayOf(e);
    if (!on || (until && on > until)) continue;
    const day = byDay.get(on) ?? { booked: [], done: [] };
    (e.kind === 'interview_scheduled' ? day.booked : day.done).push(e);
    byDay.set(on, day);
  }
  /** @type {Round[]} */
  const rounds = [];
  for (const on of [...byDay.keys()].sort()) {
    const { booked, done } = /** @type {{ booked: any[], done: any[] }} */ (byDay.get(on));
    for (let i = 0; i < Math.max(booked.length, done.length); i += 1) {
      rounds.push({ on, type: interviewTypeOf(done[i]?.title) ?? interviewTypeOf(booked[i]?.title) });
    }
  }
  return rounds;
}

const ORDINALS = ['1st', '2nd', '3rd'];
/** @param {number} n */
const ordinal = (n) => ORDINALS[n - 1] ?? `${n}th`;

/** The old tracker's stages, as a closed application kept them: the furthest one reached. */
const LEGACY_STAGES = /** @type {Record<string, { label: string, type: InterviewType | null, after: boolean }>} */ ({
  'Coding Assessment': { label: 'Assessment', type: null, after: true },
  // The database also writes this one when a status moves to Interview by hand, so it says no more than that.
  'Video Interview': { label: 'Interview', type: null, after: true },
  'HR Interview': { label: 'HR interview', type: 'hr', after: true },
  'Technical Interview': { label: 'Technical interview', type: 'technical', after: true },
  'Final Round': { label: 'Final round', type: 'final', after: true },
});

/**
 * @typedef {object} StageReached
 * @property {string} label   'Screening', 'Assessment', 'Technical interview', '2nd interview'
 * @property {InterviewType | null} type
 * @property {number} rounds  interview rounds in the History
 * @property {string} phrase  for a sentence: 'at screening', 'after the technical interview'
 */

/**
 * How far an application got: its last step, an interview (by its kind, else its round) or a test or
 * task, whichever came later; with neither, the old tracker's stage; else screening. For a rejected
 * application this is where it stopped.
 * @param {{ phase: string, events: any[], app?: any }} d
 * @param {string} today
 * @returns {StageReached}
 */
export function stageReached(d, today) {
  const rounds = interviewRounds(d, today);
  const until = lastLiveDay(d, today) ?? today;
  const tests = d.events.filter((e) => e.kind === 'assessment').map((e) => dayOf(e) ?? '').filter((x) => x && x <= until).sort();
  const lastTest = tests.length ? tests[tests.length - 1] : null;
  const lastRound = rounds.length ? rounds[rounds.length - 1] : null;
  const assessment = { label: 'Assessment', type: null, rounds: rounds.length, phrase: 'after the assessment' };
  if (lastRound && !(lastTest && lastTest > lastRound.on)) {
    const label = interviewTypeLabel(lastRound.type) ?? `${ordinal(rounds.length)} interview`;
    return { label, type: lastRound.type, rounds: rounds.length, phrase: `after the ${lowerFirst(label)}` };
  }
  if (lastTest && lastRound) return assessment;
  // No interview in the History: the old tracker's interview stage says more than a test does.
  const legacy = LEGACY_STAGES[String(d.app?.stage ?? '')];
  if (legacy && legacy.label !== 'Assessment') return { label: legacy.label, type: legacy.type, rounds: 0, phrase: `after the ${lowerFirst(legacy.label)}` };
  if (lastTest || legacy) return assessment;
  return { label: 'Screening', type: null, rounds: 0, phrase: 'at screening' };
}
