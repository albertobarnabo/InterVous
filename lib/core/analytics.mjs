// "Your search in numbers" on /home: the counts and chart data behind it.
//
//   totals     six tiles: sent, got a reply, reached an interview, offers, rejected, no reply
//   timeline   per week (per month once the span passes 16 weeks): CVs built, sent, and what came back
//   status     every application by its current status
//   rejections how many, before or after an interview, and how long they took
//   where      sent applications split by country, role family, channel, visa and company
//
// No new definition lives here: sent, responded, mature, interviewed and silence come from
// derive.mjs, and the funnel, reply rate, reply time, silence buckets and group comparison are the
// sections of computeInsights, passed through as they are. The tiles and rows here are plain counts
// and "k of n": the one percentage on the page is the reply rate, with its range (spec 5.2).

import { addDays, daysBetween, formatShort, isoWeekStart, pluralDays, toDateOnly } from './dates.mjs';
import { PHASES, isOpen } from './phases.mjs';
import { buildContext } from './derive.mjs';
import { describeRate, median } from './stats.mjs';
import { computeInsights, GROUP_DIMENSIONS } from './insights.mjs';
import { joinNames } from './home.mjs';

/** Past this span the timeline switches from weeks to months. */
export const TIMELINE_MAX_WEEKS = 16;
/** A new search still shows this many weeks, so one column does not fill the chart. */
export const TIMELINE_MIN_WEEKS = 8;
/** Most rows in one breakdown; the rest fold into "n others". */
export const WHERE_MAX_ROWS = 6;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const SERIES = /** @type {const} */ (['built', 'sent', 'replies', 'interviews', 'rejections', 'offers']);
const REPLY_KINDS = new Set(['reply', 'assessment']);
/** Groups with no real value: a comparison sentence about them says nothing. */
const UNKNOWN_KEYS = new Set(['unknown', 'none']);

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
 * Events on or before today.
 * @param {import('./derive.mjs').Derived} d
 * @param {string} today
 */
function pastEvents(d, today) {
  return d.events.filter((e) => {
    const on = dayOf(e);
    return on !== null && on <= today;
  });
}

/**
 * The date of an outcome: its newest event or status change (a reopened application's outcome is its last one).
 * @param {any[]} past  oldest first
 * @param {string} kind
 * @param {string} phase
 * @returns {string | null}
 */
function outcomeOn(past, kind, phase) {
  const e = [...past].reverse().find((x) => x.kind === kind || (x.kind === 'phase_change' && x.to_phase === phase));
  return e ? dayOf(e) : null;
}

/**
 * The days of the interview rounds. A booking is a round; "interview done" closes the booking before
 * it, and is a round of its own only when no booking is open (a past interview logged after the fact).
 * @param {any[]} past  oldest first
 * @returns {string[]}
 */
function roundDays(past) {
  /** @type {string[]} */
  const days = [];
  let open = 0;
  // Within a day, bookings first: a booking with a time sorts after a same-day "done" that has none.
  const rank = (/** @type {any} */ e) => (e.kind === 'interview_scheduled' ? 0 : 1);
  const ordered = [...past].sort((x, y) => String(dayOf(x)).localeCompare(String(dayOf(y))) || rank(x) - rank(y));
  for (const e of ordered) {
    if (e.kind === 'interview_scheduled') {
      days.push(/** @type {string} */ (dayOf(e)));
      open += 1;
    } else if (e.kind === 'interview_done') {
      if (open > 0) open -= 1;
      else days.push(/** @type {string} */ (dayOf(e)));
    }
  }
  return days;
}

/**
 * What came back for one sent application.
 * Replies count once per application; each interview round counts; a rejection or offer counts once.
 * The rest is accounted for: `undated` outcomes with no date, interviews `booked` ahead on an open
 * application, and bookings that `neverHeld` (the application closed first).
 * @param {import('./derive.mjs').Derived} d
 * @param {string} today
 * @returns {{ marks: Array<[string, string]>, undated: number, booked: number, neverHeld: number }}
 */
function outcomesOf(d, today) {
  const past = pastEvents(d, today);
  const noEvents = d.events.length === 0;
  /** @type {Array<[string, string]>} */
  const marks = [];
  let undated = 0;
  const hasBooking = d.events.some((e) => e.kind === 'interview_scheduled');
  // Strictly after today, the same date test as pastEvents: an event is past or ahead, never both.
  const booked = isOpen(d.phase) ? d.events.filter((e) => e.kind === 'interview_scheduled' && (dayOf(e) ?? '') > today).length : 0;

  const rejectedOn = d.phase === 'rejected' ? outcomeOn(past, 'rejection', 'rejected') ?? (noEvents ? d.responseOn : null) : null;

  // A move to In process only counts while the row still counts as answered: it may have been undone.
  const reply = past.find((e) => REPLY_KINDS.has(e.kind)) ?? (d.responded ? past.find((e) => e.kind === 'phase_change' && e.to_phase === 'screening') : undefined);
  if (reply) marks.push(['replies', /** @type {string} */ (dayOf(reply))]);
  else if (noEvents && d.responseOn && d.phase !== 'rejected') marks.push(['replies', d.responseOn]);

  // A booking dated after the rejection never took place.
  const rounds = roundDays(past);
  const held = rounds.filter((on) => !rejectedOn || on <= rejectedOn);
  for (const on of held) marks.push(['interviews', on]);
  const neverHeld = hasBooking && held.length === 0 && !booked ? 1 : 0;
  if (d.interviewed && rounds.length === 0 && !hasBooking) {
    const moved = past.find((e) => e.kind === 'phase_change' && e.to_phase === 'interviewing');
    if (moved) marks.push(['interviews', /** @type {string} */ (dayOf(moved))]);
    else undated += 1;
  }

  if (d.phase === 'rejected') {
    if (rejectedOn) marks.push(['rejections', rejectedOn]);
    else undated += 1;
  }
  if (d.offered) {
    const on = outcomeOn(past, 'offer', 'offer');
    if (on) marks.push(['offers', on]);
    else undated += 1;
  }
  if (d.responded && marks.length === 0 && undated === 0 && !booked && !neverHeld) {
    if (d.responseOn) marks.push(['replies', d.responseOn]);
    else undated += 1;
  }
  return { marks, undated, booked, neverHeld };
}

/** '2026-08-14' -> '2026-08-01' @param {string} date */
const monthStart = (date) => `${date.slice(0, 7)}-01`;

/** '2026-12-01' -> '2027-01-01' @param {string} date */
function nextMonth(date) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

/**
 * @param {import('./derive.mjs').Derived[]} base
 * @param {import('./derive.mjs').Context} ctx
 */
function buildTimeline(base, ctx) {
  const { today, settings } = ctx;
  /** @type {Array<[string, string]>} */
  const marks = [];
  let undatedOutcomes = 0;
  let bookedInterviews = 0;
  let neverHeld = 0;
  for (const d of base) {
    if (d.cvBuiltOn && d.cvBuiltOn <= today) marks.push(['built', d.cvBuiltOn]);
    if (d.dated && /** @type {string} */ (d.appliedOn) <= today) marks.push(['sent', /** @type {string} */ (d.appliedOn)]);
    if (!d.sent) continue;
    const back = outcomesOf(d, today);
    marks.push(...back.marks);
    undatedOutcomes += back.undated;
    bookedInterviews += back.booked;
    neverHeld += back.neverHeld;
  }

  const thisWeekStart = isoWeekStart(today);
  const thisWeek = base.filter((d) => d.dated && /** @type {string} */ (d.appliedOn) >= thisWeekStart && /** @type {string} */ (d.appliedOn) <= today).length;
  const undatedSent = base.filter((d) => d.sent && !d.dated).length;
  const sentCount = base.filter((d) => d.sent).length;
  const target = settings.weekly_target;

  /** @type {Record<string, number>} */
  const totals = Object.fromEntries(SERIES.map((s) => [s, 0]));
  /** @type {Array<{ start: string, tick: string, title: string, values: Record<string, number> }>} */
  const buckets = [];
  /** @type {'week' | 'month'} */
  let unit = 'week';

  if (marks.length) {
    const first = marks.reduce((min, m) => (m[1] < min ? m[1] : min), marks[0][1]);
    const firstWeek = isoWeekStart(first);
    unit = /** @type {number} */ (daysBetween(firstWeek, today)) / 7 < TIMELINE_MAX_WEEKS ? 'week' : 'month';
    if (unit === 'week') {
      const floor = addDays(thisWeekStart, -7 * (TIMELINE_MIN_WEEKS - 1));
      for (let s = firstWeek < floor ? firstWeek : floor; s <= today; s = addDays(s, 7)) {
        // the axis stays short ('16 Nov'); the title carries the year when it differs
        buckets.push({ start: s, tick: formatShort(s, { today: s }), title: `Week of ${formatShort(s, { today })}`, values: {} });
      }
    } else {
      for (let s = monthStart(first); s <= today; s = nextMonth(s)) {
        const name = MONTHS[Number(s.slice(5, 7)) - 1];
        const showYear = buckets.length === 0 || s.slice(5, 7) === '01';
        buckets.push({ start: s, tick: showYear ? `${name.slice(0, 3)} ’${s.slice(2, 4)}` : name.slice(0, 3), title: `${name} ${s.slice(0, 4)}`, values: {} });
      }
    }
    const index = new Map(buckets.map((b) => [b.start, b]));
    for (const b of buckets) for (const s of SERIES) b.values[s] = 0;
    for (const [series, on] of marks) {
      const b = index.get(unit === 'week' ? isoWeekStart(on) : monthStart(on));
      if (!b) continue;
      b.values[series] += 1;
      totals[series] += 1;
    }
  }

  const noDate = undatedSent
    ? ` ${undatedSent} sent ${plural(undatedSent, 'application has', 'applications have')} no date, so ${plural(undatedSent, 'it is', 'they are')} not on this chart.`
    : '';
  const paceLine = sentCount === 0
    ? 'Nothing sent yet.'
    : `${thisWeek} sent this week, target ${target}.${noDate}`;

  const parts = /** @type {string[]} */ ([
    totals.replies && `${totals.replies} ${plural(totals.replies, 'reply', 'replies')}`,
    totals.interviews && `${totals.interviews} ${plural(totals.interviews, 'interview', 'interviews')}`,
    totals.rejections && `${totals.rejections} ${plural(totals.rejections, 'rejection', 'rejections')}`,
    totals.offers && `${totals.offers} ${plural(totals.offers, 'offer', 'offers')}`,
  ].filter((p) => typeof p === 'string'));
  const notes = [];
  if (bookedInterviews) {
    notes.push(`${bookedInterviews} ${plural(bookedInterviews, 'interview is', 'interviews are')} booked ahead.`);
  }
  if (neverHeld) {
    notes.push(`${neverHeld} booked ${plural(neverHeld, 'interview', 'interviews')} never took place.`);
  }
  if (undatedOutcomes) {
    const who = parts.length ? `${undatedOutcomes} more` : `${undatedOutcomes} ${plural(undatedOutcomes, 'outcome', 'outcomes')}`;
    notes.push(`${who} ${plural(undatedOutcomes, 'has', 'have')} no date, so ${plural(undatedOutcomes, 'it is', 'they are')} not on this chart.`);
  }
  const lead = parts.length ? [`So far: ${joinNames(parts)}.`] : notes.length ? [] : ['Nothing has come back yet.'];

  return {
    unit, buckets, totals, undatedSent, undatedOutcomes, bookedInterviews, neverHeld, thisWeek,
    target: unit === 'week' ? target : null,
    paceLine,
    cameBackLine: [...lead, ...notes].join(' '),
    hasCameBack: parts.length > 0,
  };
}

/**
 * 'DE' -> 'Germany'; anything that is not a region code stays as it is.
 * @param {string} code
 * @param {string} fallback
 */
function regionName(code, fallback) {
  if (!/^[A-Z]{2}$/.test(code)) return fallback;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? fallback;
  } catch {
    return fallback;
  }
}

const COMPANY_DIMENSION = {
  id: 'company',
  label: 'Company',
  keyOf: (/** @type {import('./derive.mjs').Derived} */ d) => d.company.trim().toLowerCase() || 'unknown',
};

/**
 * Sent applications per group, biggest first, each with its replies among those old enough to judge.
 * @param {import('./derive.mjs').Derived[]} sent
 * @param {{ keyOf: (d: import('./derive.mjs').Derived) => string, labelOf?: (key: string) => string, id: string }} dim
 */
function groupSent(sent, dim) {
  /** @type {Map<string, import('./derive.mjs').Derived[]>} */
  const groups = new Map();
  for (const d of sent) {
    const k = dim.keyOf(d);
    groups.set(k, [...(groups.get(k) ?? []), d]);
  }
  const rows = [...groups.entries()].map(([key, list]) => {
    const mature = list.filter((d) => d.mature);
    let label = dim.labelOf ? dim.labelOf(key) : list[0].company.trim() || 'Unknown';
    if (dim.id === 'country_code') label = regionName(key, label);
    return { key, label, sent: list.length, k: mature.filter((d) => d.responded).length, n: mature.length };
  }).sort((a, b) => b.sent - a.sent || a.label.localeCompare(b.label));
  const shown = rows.length > WHERE_MAX_ROWS ? rows.slice(0, WHERE_MAX_ROWS - 1) : rows;
  const rest = rows.slice(shown.length);
  if (rest.length) {
    shown.push({
      // data keys are lowercase words or codes, so this one cannot collide
      key: '__others', label: `${rest.length} others`,
      sent: rest.reduce((s, r) => s + r.sent, 0),
      k: rest.reduce((s, r) => s + r.k, 0),
      n: rest.reduce((s, r) => s + r.n, 0),
    });
  }
  return shown.map(({ k, n, ...r }) => ({ ...r, replied: n ? describeRate(k, n) : null }));
}

/**
 * Was there an interview before this rejection? Going by the events when there are any, because an
 * interview stage stays on a row whose booked interview never took place; else by the row itself.
 * @param {import('./derive.mjs').Derived} d
 * @param {string | null} rejectedOn
 * @param {string} today
 */
function interviewedBefore(d, rejectedOn, today) {
  const rounds = roundDays(pastEvents(d, today));
  if (rounds.length || d.events.some((e) => e.kind === 'interview_scheduled')) {
    return rounds.some((on) => !rejectedOn || on <= rejectedOn);
  }
  return d.interviewed;
}

/**
 * @param {import('./derive.mjs').Derived[]} base
 * @param {import('./derive.mjs').Context} ctx
 */
function buildRejections(base, ctx) {
  const { today } = ctx;
  const rejected = base.filter((d) => d.phase === 'rejected');
  /** @type {number[]} */
  const days = [];
  let afterInterview = 0;
  for (const d of rejected) {
    const past = pastEvents(d, today);
    if (interviewedBefore(d, outcomeOn(past, 'rejection', 'rejected'), today)) afterInterview += 1;
    // Only a rejection's own event dates it: a status change says when the row was edited.
    const own = [...past].reverse().find((e) => e.kind === 'rejection');
    const n = own && d.appliedOn ? daysBetween(d.appliedOn, dayOf(own)) : null;
    if (n !== null && n >= 0) days.push(n);
  }
  const beforeInterview = rejected.length - afterInterview;
  const med = median(days);
  const usually = (/** @type {number} */ n, /** @type {number} */ base) => (n === 0
    ? `They usually come the day you send (${base} with a date).`
    : `They usually come about ${pluralDays(n)} after sending (${base} with a date).`);
  const answer = rejected.length === 0
    ? 'No rejections so far.'
    : `${rejected.length} ${plural(rejected.length, 'rejection', 'rejections')}: ${beforeInterview} before an interview, ${afterInterview} after one.`
      + (med.allowed ? ` ${usually(Math.round(/** @type {number} */ (med.value)), days.length)}` : '');
  return { count: rejected.length, beforeInterview, afterInterview, median: med, answer };
}

/**
 * The reply-time sentence, counting the replies with no exact date too, so "so far" cannot read as
 * fewer replies than the tile above it.
 * @param {any} i4
 */
function replyTimeLine(i4) {
  const known = i4.dots.length;
  const unknown = i4.unknownDates;
  if (!unknown) return i4.answer;
  if (known === 0) return `${unknown} ${plural(unknown, "reply can't", "replies can't")} be timed: a date is missing or out of order.`;
  if (i4.median.allowed) return `${i4.answer} ${unknown} more can't be timed.`;
  const parts = i4.dots.map((/** @type {any} */ d) => `${d.company}, after ${pluralDays(d.days)}`);
  return `${known + unknown} replies, ${known} with ${plural(known, 'an exact date', 'exact dates')}: ${parts.join('; ')}.`;
}

/**
 * The one comparison sentence over the breakdowns. Names the split it speaks about, and only speaks
 * about groups with a real value; the rule itself is compareGroups (spec 5.2).
 * @param {any} i8
 */
function whereLine(i8) {
  const nameOf = (/** @type {any} */ dim, /** @type {string} */ key, /** @type {string} */ label) => (dim.id === 'country_code' ? regionName(key, label) : label);
  for (const dim of i8.dimensions) {
    const s = dim.comparison.statements.find((/** @type {any} */ x) => !UNKNOWN_KEYS.has(x.higher) && !UNKNOWN_KEYS.has(x.lower));
    if (!s) continue;
    const label = (/** @type {string} */ key) => nameOf(dim, key, dim.groups.find((/** @type {any} */ g) => g.key === key)?.label ?? key);
    return `A clear difference by ${dim.label.toLowerCase()}: ${label(s.higher)} gets replies more often than ${label(s.lower)}.`;
  }
  const compared = i8.dimensions
    .filter((/** @type {any} */ dim) => dim.comparison.allowed && dim.comparison.statements.length === 0)
    .map((/** @type {any} */ dim) => dim.label.toLowerCase());
  return compared.length ? `No clear difference by ${joinNames(compared)} yet.` : 'Too few to compare yet.';
}

/**
 * @typedef {object} AnalyticsOptions
 * @property {'campaign' | 'all'} [window]  'campaign' (default): rows since settings.campaign_start; 'all': every row
 */

/**
 * Everything "Your search in numbers" shows.
 * @param {import('./derive.mjs').CoreInput} input
 * @param {AnalyticsOptions} [opts]
 */
export function computeAnalytics(input, opts = {}) {
  const windowMode = opts.window === 'all' ? 'all' : 'campaign';
  const ins = computeInsights(input, { window: windowMode });
  const ctx = buildContext(input);
  const { settings } = ctx;
  const inWindow = ctx.all.filter((d) => d.inWindow);
  const older = ctx.all.filter((d) => !d.inWindow);
  const base = windowMode === 'all' ? ctx.all : inWindow;
  const sent = base.filter((d) => d.sent);

  const since = formatShort(settings.campaign_start, { withYear: true });
  const olderRejected = older.filter((d) => d.phase === 'rejected').length;
  const oneOlder = older.length === 1;
  const records = `${older.length} older ${plural(older.length, 'record', 'records')} from before ${since}`;
  let note = null;
  if (older.length) {
    const rejectedNote = !olderRejected ? '' : oneOlder ? '; it was rejected' : `, ${olderRejected} of them rejected`;
    note = windowMode === 'campaign'
      ? `${records} ${plural(older.length, "isn't", "aren't")} counted here${rejectedNote}.`
      : `Includes ${records}. ${oneOlder ? 'It is' : 'They are'} incomplete, so replies may look better than they were.`;
  }
  const unconfirmed = ins.unconfirmedInScope;

  // The funnel's counts, so the tiles and the funnel cannot disagree.
  const step = (/** @type {string} */ id) => ins.i3.steps.find((s) => s.id === id)?.count ?? 0;
  const nr = settings.no_reply_after_days;
  const noReply = sent.filter((d) => d.phase === 'no_reply'
    || (!d.responded && d.phase !== 'withdrawn' && d.silenceDays !== null && d.silenceDays >= nr)).length;
  const totals = [
    { id: 'sent', label: 'Sent', count: sent.length, detail: `of ${base.length} tracked`, phase: 'applied' },
    { id: 'replied', label: 'Got a reply', count: step('responded'), detail: null, phase: 'screening' },
    { id: 'interviews', label: 'Reached an interview', count: step('interview'), detail: null, phase: 'interviewing' },
    { id: 'offers', label: 'Offers', count: step('offer'), detail: null, phase: 'offer' },
    { id: 'rejected', label: 'Rejected', count: base.filter((d) => d.phase === 'rejected').length, detail: null, phase: 'rejected' },
    { id: 'no_reply', label: 'No reply', count: noReply, detail: `silent ${nr}+ days, or marked so`, phase: 'no_reply' },
  ];

  const status = PHASES
    .map((phase) => ({ phase, count: base.filter((d) => d.phase === phase).length }))
    .filter((s) => s.count > 0);

  const dimensions = [
    ...['country_code', 'role_family', 'channel', 'visa_needed'].map((id) => /** @type {any} */ (GROUP_DIMENSIONS.find((x) => x.id === id))),
    COMPANY_DIMENSION,
  ];
  const where = dimensions
    .map((dim) => ({ id: dim.id, label: dim.label, rows: groupSent(sent, dim) }))
    .filter((w) => w.rows.length > 0);

  return {
    today: ctx.today,
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
        ? `${unconfirmed} ${plural(unconfirmed, 'application has', 'applications have')} details still to confirm.`
        : null,
    },
    intro: ins.intro,
    totals,
    timeline: buildTimeline(base, ctx),
    status,
    rejections: buildRejections(base, ctx),
    replyTimeLine: replyTimeLine(ins.i4),
    where,
    whereLine: whereLine(ins.i8),
    i1: ins.i1,
    i2: ins.i2,
    i3: ins.i3,
    i4: ins.i4,
    i5: ins.i5,
    i8: ins.i8,
  };
}
