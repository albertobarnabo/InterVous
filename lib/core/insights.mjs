// Insights I1-I10 (section 5.4), shared by /insights and `intervous insights`.
// Every rate goes through stats.mjs, so no percentage is ever produced below n = 20,
// no comparison sentence without n >= 10 per group and non-overlapping intervals,
// and no median below 5 values.

import { daysBetween, formatShort, isoWeekStart, addDays, pluralDays } from './dates.mjs';
import { OPEN_PHASES, topicLabel, CHANNEL_LABELS, roleFamilyLabel } from './phases.mjs';
import { buildContext, weeksOrDays } from './derive.mjs';
import { describeRate, compareGroups, median, quantile, displayFor } from './stats.mjs';
import { buildToday, itemToActions } from './today.mjs';


/** @param {import('./derive.mjs').Derived} d */
function who(d) {
  return { appId: d.id, slug: d.slug, ref: d.ref, company: d.company, role: d.role, phase: d.phase };
}

/**
 * Dot state for a sent application: replied, no reply although old enough, or still waiting.
 * @param {import('./derive.mjs').Derived} d
 * @returns {'yes' | 'no' | 'waiting'}
 */
function outcomeState(d) {
  if (d.responded) return 'yes';
  return d.mature ? 'no' : 'waiting';
}

/**
 * @param {string[]} names
 * @returns {string}
 */
function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------
// I7 number check
// ---------------------------------------------------------------------------

/**
 * Numbers in a proof-point wording. Based on the spec's pattern
 * /\d+(\.\d+)?\s?%|\$\d+(\.\d+)?|\d{2,}\s?(cases|docs)/g, extended to read "300+ cases" and "302-case".
 */
const NUMBER_RE = /\$\d+(?:\.\d+)?|\d+(?:\.\d+)?\s?%|\d{2,}\+?[\s-]?(?:cases?|docs?)\b/gi;

/**
 * @typedef {object} ExtractedNumber
 * @property {string} raw     e.g. '84.7%'
 * @property {string} phrase  the number with its metric words, e.g. '84.7% strict F1'
 * @property {number} value
 * @property {boolean} atLeast '300+ cases'
 * @property {string} metric  canonical metric: partial_credit, exact_match, level_overlap_f1, f1, precision, recall,
 *                            accuracy, cases, cost_per_doc, '$' or '%' (a percentage with no metric word)
 */

/**
 * Extract the numbers of a wording and name the metric each one carries
 * ("84.7% strict F1" -> exact_match, because strict means exact match).
 * @param {string | null | undefined} text
 * @returns {ExtractedNumber[]}
 */
export function extractNumbers(text) {
  if (!text) return [];
  /** @type {ExtractedNumber[]} */
  const out = [];
  for (const m of text.matchAll(NUMBER_RE)) {
    const raw = m[0];
    const idx = /** @type {number} */ (m.index);
    const value = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
    const atLeast = raw.includes('+');
    let metric;
    const tail = (text.slice(idx + raw.length).split(/[,;()]|\band\b/)[0] || '').trimEnd();
    const phrase = `${raw}${tail}`.trim();
    if (raw.startsWith('$')) {
      const after = text.slice(idx + raw.length, idx + raw.length + 10).toLowerCase();
      metric = /^\s?(\/|per\s)\s?doc/.test(after) ? 'cost_per_doc' : '$';
    } else if (/case|doc/i.test(raw)) {
      metric = /case/i.test(raw) ? 'cases' : 'docs';
    } else {
      // words right after the number (to the next separator) and the word right before it
      const after = (text.slice(idx + raw.length).split(/[,;()/]|\band\b/)[0] || '').toLowerCase();
      const beforeChunk = text.slice(0, idx).split(/[,;(/]/).pop() || '';
      const before = (beforeChunk.trim().split(/\s+/).pop() || '').toLowerCase();
      const words = `${before} ${after}`;
      if (/partial/.test(words)) metric = 'partial_credit';
      else if (/exact|strict/.test(words)) metric = 'exact_match';
      else if (/overlap|level/.test(words) && /f1/.test(words)) metric = 'level_overlap_f1';
      else if (/f1/.test(words)) metric = 'f1';
      else if (/precision/.test(words)) metric = 'precision';
      else if (/recall/.test(words)) metric = 'recall';
      else if (/accura/.test(words)) metric = 'accuracy';
      else metric = '%';
    }
    out.push({ raw: raw.trim(), phrase, value, atLeast, metric });
  }
  return out;
}

/**
 * @param {unknown} v
 * @returns {number | null}
 */
function factNumber(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return null;
  const m = /-?\d+(?:\.\d+)?/.exec(v);
  return m ? Number.parseFloat(m[0]) : null;
}

/**
 * @param {number} a
 * @param {number} b
 */
function same(a, b) {
  return Math.abs(a - b) < 0.05;
}

/**
 * Number check of one proof point across the applications that used it.
 * @param {any} pp proof_points row
 * @param {Array<{ who: any, detail: string | null, numbers: ExtractedNumber[] }>} wordings
 */
function checkNumbers(pp, wordings) {
  const facts = pp && pp.facts && typeof pp.facts === 'object' ? pp.facts : {};
  /** @type {Record<string, number>} */
  const factNums = {};
  for (const [k, v] of Object.entries(facts)) {
    const n = factNumber(v);
    if (n !== null) factNums[k] = n;
  }
  const percentFacts = Object.entries(facts).filter(([, v]) => typeof v === 'string' && v.includes('%')).map(([k]) => k);
  /** @type {any[]} */
  const flags = [];

  // 1. a value differs from the canonical fact
  for (const w of wordings) {
    for (const n of w.numbers) {
      let factKeys;
      if (n.metric === '%') factKeys = percentFacts;
      else if (n.metric === 'f1') factKeys = Object.keys(factNums).filter((k) => k.includes('f1'));
      else factKeys = n.metric in factNums ? [n.metric] : [];
      if (!factKeys.length) continue;
      const ok = factKeys.some((k) => (n.atLeast ? factNums[k] >= n.value : same(factNums[k], n.value)));
      if (!ok) {
        const shown = factKeys.length === 1 ? `${factKeys[0].replace(/_/g, ' ')} is ${facts[factKeys[0]]}` : `the facts say ${factKeys.map((k) => facts[k]).join(', ')}`;
        flags.push({ type: 'differs_from_fact', metric: n.metric, value: n.raw, phrase: n.phrase, fact: factKeys.length === 1 ? facts[factKeys[0]] : null,
          ...w.who, text: `${w.who.company} (${w.who.role}) was told "${n.phrase}"; ${shown}.` });
      } else if (n.metric === '%' && percentFacts.length > 1) {
        flags.push({ type: 'unlabeled', metric: '%', value: n.raw, phrase: n.phrase, ...w.who,
          text: `${w.who.company} (${w.who.role}) was told "${n.raw}" with no metric name; the facts hold ${percentFacts.length} different percentages.` });
      }
    }
  }

  // 2. the same metric carries different values across applications
  /** @type {Map<string, Map<string, Set<string>>>} */
  const byMetric = new Map();
  for (const w of wordings) {
    for (const n of w.numbers) {
      if (n.atLeast) continue;
      const vals = byMetric.get(n.metric) ?? new Map();
      const key = String(Math.round(n.value * 10) / 10);
      const slugs = vals.get(key) ?? new Set();
      slugs.add(w.who.slug ?? String(w.who.appId));
      vals.set(key, slugs);
      byMetric.set(n.metric, vals);
    }
  }
  for (const [metric, vals] of byMetric) {
    if (vals.size < 2) continue;
    const values = [...vals.entries()].map(([value, slugs]) => ({ value: Number(value), apps: [...slugs] }));
    flags.push({ type: 'inconsistent', metric, values,
      text: `${metric === '%' ? 'Percentages' : metric.replace(/_/g, ' ')} differ between applications: ${values.map((v) => v.value).join(' vs ')}.` });
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Salary display (I10)
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOL = /** @type {Record<string, string>} */ ({ USD: '$', EUR: '€', GBP: '£', CHF: 'CHF ' });
const PERIOD_WORD = /** @type {Record<string, string>} */ ({ year: 'a year', month: 'a month', day: 'a day', hour: 'an hour' });

/**
 * '$230K–385K a year', '€4,982 a month'. Not converted between currencies.
 * @param {{ salary_min?: number | string | null, salary_max?: number | string | null, salary_currency?: string | null, salary_period?: string | null }} row
 * @returns {string | null}
 */
export function formatSalary(row) {
  const min = row.salary_min == null ? null : Number(row.salary_min);
  const max = row.salary_max == null ? null : Number(row.salary_max);
  if (min === null && max === null) return null;
  const sym = CURRENCY_SYMBOL[row.salary_currency ?? ''] ?? (row.salary_currency ? `${row.salary_currency} ` : '');
  const useK = row.salary_period === 'year' && (min ?? max ?? 0) >= 10000;
  const one = (/** @type {number} */ v) => (useK ? `${Math.round(v / 1000)}K` : v.toLocaleString('en-US'));
  let amount;
  if (min !== null && max !== null && min !== max) amount = `${sym}${one(min)}–${one(max)}`;
  else amount = `${sym}${one(/** @type {number} */ (min ?? max))}`;
  const per = PERIOD_WORD[row.salary_period ?? ''];
  return per ? `${amount} ${per}` : amount;
}

// ---------------------------------------------------------------------------
// The insights
// ---------------------------------------------------------------------------

/**
 * @typedef {object} InsightOptions
 * @property {'campaign' | 'all'} [window]   'campaign' (default): rows since settings.campaign_start; 'all': every row
 * @property {boolean} [onlyConfirmed]      drop rows whose `uncertain` is not empty
 */

/**
 * Funnel of sent -> responded -> interview -> offer. Counts only; the step rates come from
 * describeRate, so they carry no percentage below n = 20.
 * @param {import('./derive.mjs').Derived[]} rows
 */
function funnel(rows) {
  const sent = rows.filter((d) => d.sent);
  const responded = sent.filter((d) => d.responded);
  const interview = sent.filter((d) => d.interviewed);
  const offer = sent.filter((d) => d.offered);
  const steps = [
    { id: 'sent', label: 'Sent', count: sent.length },
    { id: 'responded', label: 'Replied', count: responded.length },
    { id: 'interview', label: 'Interview', count: interview.length },
    { id: 'offer', label: 'Offer', count: offer.length },
  ];
  const rates = steps.slice(1).map((s, i) => ({ from: steps[i].id, to: s.id, rate: describeRate(s.count, steps[i].count) }));
  return { steps, rates, line: steps.map((s) => s.count).join(' → ') };
}

/**
 * Compute every insight section.
 * @param {import('./derive.mjs').CoreInput} input
 * @param {InsightOptions} [opts]
 */
export function computeInsights(input, opts = {}) {
  const ctx = buildContext(input);
  const { settings, today } = ctx;
  const fmt = (/** @type {string | null} */ x) => formatShort(x, { today });
  const windowMode = opts.window === 'all' ? 'all' : 'campaign';
  const inScope = windowMode === 'all' ? ctx.all : ctx.all.filter((d) => d.inWindow);
  const unconfirmedInScope = inScope.filter((d) => d.unconfirmed).length;
  const base = opts.onlyConfirmed ? inScope.filter((d) => !d.unconfirmed) : inScope;
  const baseIds = new Set(base.map((d) => String(d.id)));
  const olderRows = ctx.all.filter((d) => !d.inWindow);

  const sent = base.filter((d) => d.sent);
  const dated = sent.filter((d) => d.dated);
  const undated = sent.filter((d) => !d.dated);
  const mature = base.filter((d) => d.mature);
  const matureResponded = mature.filter((d) => d.responded);
  const drafts = base.filter((d) => d.phase === 'draft');
  const fu = settings.follow_up_after_days, nr = settings.no_reply_after_days, ma = settings.mature_after_days;

  const sample = {
    tracked: base.length, sent: sent.length, dated: dated.length, undated: undated.length,
    mature: mature.length, responded: matureResponded.length, drafts: drafts.length,
    unconfirmed: base.filter((d) => d.unconfirmed).length, older: olderRows.length,
  };
  const intro = `Based on ${sent.length} sent ${sent.length === 1 ? 'application' : 'applications'}, ${mature.length} of them old enough to judge.`
    + (displayFor(mature.length) === 'counts' ? ' Too few for percentages, so most answers are counts.' : '');

  // I1 Who owes you a reply?
  const owed = sent.filter((d) => !d.responded && d.phase !== 'no_reply' && d.phase !== 'withdrawn');
  const owedDated = owed.filter((d) => d.silenceDays !== null)
    .sort((a, b) => /** @type {number} */ (b.silenceDays) - /** @type {number} */ (a.silenceDays)
      || String(a.appliedOn).localeCompare(String(b.appliedOn)) || a.company.localeCompare(b.company));
  const owedUndated = owed.filter((d) => d.silenceDays === null);
  const bucketOf = (/** @type {number} */ n) => (n < fu ? 'wait' : n < nr ? 'follow_up' : 'likely_closed');
  const i1rows = owedDated.map((d) => ({
    ...who(d), days: d.silenceDays, appliedOn: d.appliedOn, bucket: bucketOf(/** @type {number} */ (d.silenceDays)),
    unconfirmed: d.unconfirmed, statusUnconfirmed: d.statusUnconfirmed,
    actions: [{ id: 'mark_followed_up', label: 'Followed up' }, { id: 'mark_no_reply', label: 'Mark no reply' }],
  }));
  const likely = i1rows.filter((r) => r.bucket === 'likely_closed');
  const i1 = {
    id: 'i1', question: 'Who owes you a reply?',
    answer: owed.length === 0 ? 'Nobody owes you a reply.'
      : `${owedDated.length} sent ${owedDated.length === 1 ? 'application has' : 'applications have'} had no reply`
        + (likely.length ? `; ${likely.length} of them for ${nr} days or more.` : '.')
        + (owedUndated.length ? ` ${owedUndated.length} more ${owedUndated.length === 1 ? 'has' : 'have'} no sent date.` : ''),
    n: owed.length, display: 'counts',
    rows: i1rows,
    buckets: [
      { id: 'likely_closed', label: 'Likely closed', range: `${nr}+ days`, rows: i1rows.filter((r) => r.bucket === 'likely_closed') },
      { id: 'follow_up', label: 'Follow up if you can', range: `${fu}–${nr - 1} days`, rows: i1rows.filter((r) => r.bucket === 'follow_up') },
      { id: 'wait', label: 'Wait', range: `under ${fu} days`, rows: i1rows.filter((r) => r.bucket === 'wait') },
    ],
    undated: owedUndated.map((d) => ({ ...who(d), unconfirmed: d.unconfirmed, statusUnconfirmed: d.statusUnconfirmed })),
    todo: 'Follow up where you have someone to write to; stop counting on the ones past the no-reply line and mark them.',
    howCounted: `Sent applications with no reply yet (automatic acknowledgements do not count), by days since you sent, heard back or followed up. Under ${fu} days: wait; ${fu} to ${nr - 1}: follow up if you can; ${nr} or more: likely closed. Undated sends are listed by name. n = ${owed.length}.`,
  };

  // I2 Do applications get answers?
  const i2rate = describeRate(matureResponded.length, mature.length);
  const w = weeksOrDays(ma);
  const responderNames = matureResponded.map((d) => (d.responseDays !== null ? `${d.company}, ${pluralDays(d.responseDays)}` : d.company));
  let i2answer;
  if (mature.length === 0) i2answer = `Nothing was sent more than ${w} ago yet.`;
  else if (matureResponded.length === 0) i2answer = `None of the ${mature.length} applications sent more than ${w} ago got a reply.`;
  else if (i2rate.display === 'counts') {
    i2answer = `${i2rate.countText} applications sent more than ${w} ago got a reply${responderNames.length <= 3 ? ` (${responderNames.join('; ')})` : ''}.`;
  } else if (i2rate.display === 'range') {
    i2answer = `${i2rate.countText} applications sent more than ${w} ago got a reply (${i2rate.percentText}, ${i2rate.rangeText}).`;
  } else {
    i2answer = `${i2rate.percentText} of applications sent more than ${w} ago got a reply (${i2rate.countText}, ${i2rate.rangeText}).`;
  }
  const recent = dated.filter((d) => !d.mature);
  const i2 = {
    id: 'i2', question: 'Do applications get answers?', answer: i2answer,
    n: mature.length, display: i2rate.display, rate: i2rate,
    dots: mature.map((d) => ({ state: d.responded ? 'yes' : 'no', unconfirmed: d.unconfirmed, label: d.company, slug: d.slug, ref: d.ref })),
    responders: matureResponded.map((d) => ({ ...who(d), days: d.responseDays })),
    tooRecent: recent.length,
    recent: recent.map((d) => ({ ...who(d), days: d.daysSinceApplied, state: 'recent' })),
    undated: undated.map(who),
    unconfirmedIncluded: mature.filter((d) => d.unconfirmed).length,
    todo: mature.length < 20
      ? 'Too few to judge yet. Keep sending; at 20 or more, a rate near zero points at the CV or the targeting, not luck.'
      : (i2rate.p ?? 0) < 0.1 ? 'Near zero at this sample size: the CV or the targeting is the problem, not luck.' : 'Volume is getting answers; keep the targeting.',
    howCounted: `Applications that got a reply, out of those sent at least ${ma} days ago or already answered, in the window. A rejection counts as a reply; automatic acknowledgements do not. Undated sends are left out. n = ${mature.length}.`,
  };

  // I3 How far do they get?
  const f = funnel(base);
  const fOld = funnel(olderRows);
  const i3 = {
    id: 'i3', question: 'How far do they get?',
    answer: `${f.steps[0].count} sent, ${f.steps[1].count} replied, ${f.steps[2].count} reached an interview, ${f.steps[3].count} ${f.steps[3].count === 1 ? 'offer' : 'offers'}.`,
    n: f.steps[0].count, display: displayFor(f.steps[0].count), ...f,
    older: { ...fOld, count: olderRows.length, label: 'Older records', note: 'incomplete, not comparable' },
    todo: f.steps[1].count === 0 ? 'No replies: work on the CV or the targeting.'
      : f.steps[2].count < f.steps[1].count ? 'Replies but few interviews: work on the screening stage.'
        : 'Replies turn into interviews; keep going.',
    howCounted: `Step counts. Interview: an interview_scheduled event, phase interviewing or offer, or an interview stage in the old tracker. Counts only; no conversion percentage below 20. n = ${f.steps[0].count}.`,
  };

  // I4 How long until they reply?
  const responders = sent.filter((d) => d.responded);
  const withDays = responders.filter((d) => d.responseDays !== null);
  const days = withDays.map((d) => /** @type {number} */ (d.responseDays));
  const med = median(days);
  const p75 = quantile(days, 0.75);
  const suggestion = med.allowed && p75 !== null
    ? { no_reply_after_days: Math.max(21, Math.round(2 * /** @type {number} */ (med.value))), follow_up_after_days: Math.round(p75) }
    : null;
  let i4answer;
  if (withDays.length === 0) i4answer = 'No reply with a known date yet.';
  else if (!med.allowed) {
    const parts = withDays.map((d) => `${d.company}, after ${pluralDays(/** @type {number} */ (d.responseDays))}`);
    i4answer = withDays.length === 1 ? `One reply so far: ${parts[0]}.` : `${withDays.length} replies so far: ${parts.join('; ')}.`;
  } else {
    i4answer = `Median reply time: ${pluralDays(/** @type {number} */ (med.value))} (${withDays.length} replies).`;
  }
  const i4 = {
    id: 'i4', question: 'How long until they reply?', answer: i4answer,
    n: withDays.length, display: 'counts',
    dots: withDays.map((d) => ({ ...who(d), days: d.responseDays, unconfirmed: d.unconfirmed })),
    axisMax: 60,
    unknownDates: responders.length - withDays.length,
    median: med,
    p75,
    suggestion,
    todo: suggestion
      ? `Set the no-reply line to ${suggestion.no_reply_after_days} days and follow up after about ${suggestion.follow_up_after_days}.`
      : `Keep the ${ma} / ${fu} / ${nr}-day lines until 5 replies have exact dates.`,
    howCounted: `Days from sending to the first reply, for each application that replied and has both dates. A median needs 5 or more. n = ${withDays.length}.`,
  };

  // I5 Am I sending what I build?
  const lastWeek = isoWeekStart(today);
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const start = addDays(lastWeek, -7 * i);
    const end = addDays(start, 6);
    const inWeek = (/** @type {string | null} */ x) => x !== null && x >= start && x <= end;
    weeks.push({
      start,
      series: { built: base.filter((d) => inWeek(d.cvBuiltOn)).length, sent: dated.filter((d) => inWeek(d.appliedOn)).length },
    });
  }
  const eligible = base.filter((d) => d.cvBuiltOn && d.phase !== 'skipped' && !(d.sent && !d.appliedOn)
    && ((d.draftAgeDays ?? 0) >= 14 || (d.sent && d.appliedOn)));
  const within = eligible.filter((d) => d.sent && d.appliedOn && /** @type {number} */ (daysBetween(d.cvBuiltOn, d.appliedOn)) <= 14);
  const shareRate = describeRate(within.length, eligible.length);
  /** @type {Map<string, number>} */
  const perDay = new Map();
  for (const d of dated) perDay.set(/** @type {string} */ (d.appliedOn), (perDay.get(/** @type {string} */ (d.appliedOn)) ?? 0) + 1);
  let burst = null;
  for (const [on, count] of perDay) {
    if (count >= 2 && sent.length && count / sent.length >= 0.4 && (!burst || count > burst.count)) {
      burst = { on, count, of: sent.length, text: `${count} of ${sent.length} sent on ${fmt(on)}` };
    }
  }
  const builtToday = base.filter((d) => d.cvBuiltOn === today).length;
  const draftRows = drafts.map((d) => ({ ...who(d), ageDays: d.draftAgeDays, cvBuiltOn: d.cvBuiltOn, postingGone: d.app.posting_live === false }))
    .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.company.localeCompare(b.company));
  const i5 = {
    id: 'i5', question: 'Am I sending what I build?',
    answer: `${shareRate.countText} CVs went out within 14 days of being built. ${drafts.length} ${drafts.length === 1 ? 'draft is' : 'drafts are'} waiting${builtToday ? `, ${builtToday} built today` : ''}.`,
    n: eligible.length, display: shareRate.display,
    weeks,
    drafts: draftRows,
    draftCount: drafts.length,
    builtToday,
    sentWithin14: shareRate,
    burst,
    todo: drafts.length ? 'Send or drop each draft; a CV that waits is tailoring standing in for sending.' : 'Nothing waiting.',
    howCounted: `Per ISO week, CVs built and applications sent (dated). The share counts CVs built at least 14 days ago or already sent, skipped ones left out. A burst is one day holding two fifths or more of all sends. n = ${eligible.length}.`,
  };

  // I6 What do JDs keep asking that you lack?
  /** @type {Map<string, Map<number, any[]>>} */
  const gapTopics = new Map();
  /** @type {Map<string, Set<number>>} */
  const gone = new Map();
  let otherItems = 0;
  for (const r of ctx.requirements) {
    if (!baseIds.has(String(r.job_id))) continue;
    if (r.verdict !== 'gap' && r.verdict !== 'partial') continue;
    const topic = r.topic || 'other';
    const jobId = Number(r.job_id);
    if ((r.gap_state ?? 'open') === 'no_longer_true') {
      const s = gone.get(topic) ?? new Set();
      s.add(jobId);
      gone.set(topic, s);
      continue;
    }
    if (topic === 'other') { otherItems++; continue; }
    const m = gapTopics.get(topic) ?? new Map();
    const list = m.get(jobId) ?? [];
    list.push(r);
    m.set(jobId, list);
    gapTopics.set(topic, m);
  }
  const topicRows = [...gapTopics.entries()].map(([topic, m]) => {
    const apps = [...m.entries()].map(([id, reqs]) => {
      const d = /** @type {import('./derive.mjs').Derived} */ (ctx.byId.get(id));
      const gapState = reqs[0].gap_state ?? 'open';
      return { ...who(d), gapState, outcome: d.sent ? outcomeState(d) : null, items: reqs.map((x) => x.requirement) };
    }).sort((a, b) => a.company.localeCompare(b.company));
    /** @type {Record<string, number>} */
    const byGapState = {};
    for (const a of apps) byGapState[a.gapState] = (byGapState[a.gapState] ?? 0) + 1;
    return { topic, label: topicLabel(topic), count: apps.length, apps, byGapState };
  }).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const shownTopics = topicRows.filter((t) => t.count >= 2);
  const noLongerGaps = [...gone.entries()].map(([topic, ids]) => ({
    topic, label: topicLabel(topic),
    apps: [...ids].map((id) => who(/** @type {import('./derive.mjs').Derived} */ (ctx.byId.get(id)))).sort((a, b) => a.company.localeCompare(b.company)),
  })).sort((a, b) => b.apps.length - a.apps.length || a.topic.localeCompare(b.topic));
  const top = shownTopics[0];
  const skillTop = shownTopics.find((t) => !['years_experience', 'customer_facing_title', 'leadership', 'german'].includes(t.topic) && t.count >= 3);
  const i6 = {
    id: 'i6', question: 'What do JDs keep asking that you lack?',
    answer: top ? `The gap that comes up most: ${top.label.toLowerCase()}, in ${top.count} postings.` : 'No gap appears in more than one posting yet.',
    n: new Set(ctx.requirements.filter((r) => baseIds.has(String(r.job_id))).map((r) => String(r.job_id))).size,
    display: 'counts',
    topics: shownTopics,
    singleTopics: topicRows.filter((t) => t.count < 2).map((t) => ({ topic: t.topic, label: t.label, count: t.count })),
    otherItems,
    noLongerGaps,
    todo: top && top.topic === 'years_experience'
      ? "The top gap is time in industry, not a skill: prefer postings with no years gate, or strengthen the summary's bridge."
      : skillTop ? `${skillTop.label} is asked by ${skillTop.count} postings: worth learning.` : 'Learn a skill only once 3 or more postings ask for it.',
    howCounted: 'For each topic with a gap or partial fit item still open, the number of distinct postings that asked for it, every phase included (a gap comes from the posting). Shown from 2 postings. Items marked "no longer a gap" are listed separately.',
  };

  // I7 What did you tell each company?
  const ppById = new Map(ctx.proofPoints.map((p) => [String(p.id), p]));
  /** @type {Map<string, any[]>} */
  const usesByPp = new Map();
  for (const u of ctx.jobProofPoints) {
    if (!baseIds.has(String(u.job_id))) continue;
    const list = usesByPp.get(String(u.proof_point_id)) ?? [];
    list.push(u);
    usesByPp.set(String(u.proof_point_id), list);
  }
  const ppRows = [...usesByPp.entries()].map(([ppId, uses]) => {
    const pp = ppById.get(ppId) ?? { id: ppId, key: ppId, name: ppId, facts: {}, metric_status: 'verified' };
    const wordings = uses.map((u) => {
      const d = /** @type {import('./derive.mjs').Derived} */ (ctx.byId.get(Number(u.job_id)));
      return { who: who(d), sent: d.sent, detail: u.detail ?? null, numbers: extractNumbers(u.detail) };
    }).sort((a, b) => a.who.company.localeCompare(b.who.company) || a.who.appId - b.who.appId);
    const flags = checkNumbers(pp, wordings);
    return {
      id: pp.id, key: pp.key, name: pp.name, metric: pp.metric ?? null, metricStatus: pp.metric_status ?? 'verified',
      caveat: pp.caveat ?? null, facts: pp.facts ?? {},
      uses: wordings.length, sentUses: wordings.filter((x) => x.sent).length,
      wordings: wordings.map((x) => ({ ...x.who, sent: x.sent, detail: x.detail, numbers: x.numbers })),
      flags, flagged: flags.length > 0,
    };
  }).sort((a, b) => b.uses - a.uses || b.sentUses - a.sentUses || String(a.key).localeCompare(String(b.key)));
  const unverifiedInUse = ppRows.filter((p) => p.metricStatus !== 'verified')
    .map((p) => ({ key: p.key, name: p.name, metricStatus: p.metricStatus, caveat: p.caveat,
      apps: p.wordings.filter((x) => /** @type {readonly string[]} */ (OPEN_PHASES).includes(x.phase)).map(({ appId, slug, ref, company, role, phase }) => ({ appId, slug, ref, company, role, phase })) }))
    .filter((p) => p.apps.length > 0);
  const flaggedRows = ppRows.filter((p) => p.flagged);
  const i7 = {
    id: 'i7', question: 'What did you tell each company?',
    answer: ppRows.length === 0 ? 'No proof points recorded yet.'
      : `Most used: ${ppRows.slice(0, 3).map((p) => `${p.name} (${p.uses})`).join(', ')}. `
        + (flaggedRows.length ? `${flaggedRows.length} ${flaggedRows.length === 1 ? 'proof point carries' : 'proof points carry'} numbers that differ between applications or from the facts.` : 'The numbers agree everywhere.'),
    n: ppRows.length, display: 'counts',
    proofPoints: ppRows,
    flagged: flaggedRows.map((p) => ({ key: p.key, name: p.name, flags: p.flags, wordings: p.wordings.filter((x) => x.numbers.length) })),
    unverifiedInUse,
    todo: 'Before an interview, read exactly which numbers that company saw. Stop repeating claims that are not verified.',
    howCounted: 'Uses per proof point across applications (sent ones counted separately). Numbers are read from each wording and compared across applications and with the canonical facts.',
  };

  // I8 Where are you aiming?
  const dims = [
    { id: 'visa_needed', label: 'Visa', keyOf: (/** @type {import('./derive.mjs').Derived} */ d) => (d.app.visa_needed === true ? 'needed' : d.app.visa_needed === false ? 'not_needed' : 'unknown'),
      labelOf: (/** @type {string} */ k) => ({ needed: 'Visa needed', not_needed: 'No visa needed', unknown: 'Visa unknown' })[k] ?? k },
    { id: 'role_family', label: 'Role family', keyOf: (/** @type {import('./derive.mjs').Derived} */ d) => d.app.role_family ?? 'unknown',
      labelOf: (/** @type {string} */ k) => (k === 'unknown' ? 'Unknown' : roleFamilyLabel(k)) },
    { id: 'channel', label: 'Channel', keyOf: (/** @type {import('./derive.mjs').Derived} */ d) => d.app.channel ?? 'unknown',
      labelOf: (/** @type {string} */ k) => /** @type {Record<string, string>} */ (CHANNEL_LABELS)[k] ?? 'Unknown' },
    { id: 'country_code', label: 'Country', keyOf: (/** @type {import('./derive.mjs').Derived} */ d) => d.app.country_code ?? 'none',
      labelOf: (/** @type {string} */ k) => (k === 'none' ? 'Remote or unknown' : k) },
  ];
  const dimensions = dims.map((dim) => {
    /** @type {Map<string, import('./derive.mjs').Derived[]>} */
    const groups = new Map();
    for (const d of mature) {
      const k = dim.keyOf(d);
      groups.set(k, [...(groups.get(k) ?? []), d]);
    }
    const input = [...groups.entries()].map(([key, rows]) => ({ key, label: dim.labelOf(key), k: rows.filter((d) => d.responded).length, n: rows.length }))
      .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
    const comparison = compareGroups(input);
    return {
      id: dim.id, label: dim.label, comparison,
      groups: comparison.groups.map((g) => ({
        key: g.key, label: g.label, k: g.k, n: g.n, rate: g.rate,
        dots: (groups.get(g.key) ?? []).map((d) => ({ state: d.responded ? 'yes' : 'no', unconfirmed: d.unconfirmed, label: d.company, slug: d.slug, ref: d.ref })),
      })),
    };
  });
  const anyAllowed = dimensions.find((x) => x.comparison.allowed && x.comparison.statements.length);
  const replyNames = matureResponded.map((d) => d.company);
  const visaCount = base.filter((d) => d.app.visa_needed === true).length;
  const i8 = {
    id: 'i8', question: 'Where are you aiming?',
    answer: anyAllowed ? anyAllowed.comparison.statements[0].text
      : replyNames.length === 0 ? 'Too few to compare; no replies yet.'
        : `Too few to compare; ${joinNames(replyNames)} ${replyNames.length === 1 ? 'is the only reply' : 'are the only replies'}.`,
    n: mature.length, display: anyAllowed ? 'range' : 'counts',
    dimensions,
    visa: { needed: visaCount, of: base.length, line: `Visa needed on ${visaCount} of the ${base.length} roles.` },
    todo: 'Once a group reaches 10 old-enough applications with no replies (for example roles that need a visa), move effort away from it.',
    howCounted: `Replies out of old-enough applications, split by visa, role family, channel and country. A comparison is stated only when every group has 10 or more and their likely ranges do not overlap. n = ${mature.length}.`,
  };

  // I9 Can you trust these numbers?
  const unconfirmedRows = base.filter((d) => d.unconfirmed);
  const cvUnmarked = sent.filter((d) => d.app.has_cv === true && d.app.has_sent_cv !== true);
  const noCv = sent.filter((d) => d.app.has_cv !== true);
  const unsaved = base.filter((d) => Number(d.app.unsaved_answers ?? 0) > 0);
  const unsavedCount = unsaved.reduce((s, d) => s + Number(d.app.unsaved_answers ?? 0), 0);
  const i9 = {
    id: 'i9', question: 'Can you trust these numbers?',
    answer: `${unconfirmedRows.length} ${unconfirmedRows.length === 1 ? 'application has' : 'applications have'} unconfirmed facts; `
      + `${cvUnmarked.length} sent ${cvUnmarked.length === 1 ? 'application has a CV' : 'applications have a CV'} on file that may not be the version sent; `
      + `${unsavedCount} ${unsavedCount === 1 ? 'answer exists' : 'answers exist'} only in chat.`,
    n: base.length, display: 'counts',
    unconfirmed: { count: unconfirmedRows.length, fields: unconfirmedRows.reduce((s, d) => s + d.uncertain.length, 0), rows: unconfirmedRows.map((d) => ({ ...who(d), uncertain: d.uncertain })) },
    cvNotMarkedSent: { count: cvUnmarked.length, rows: cvUnmarked.map(who) },
    sentWithoutCv: { count: noCv.length, rows: noCv.map(who) },
    unsavedAnswers: { count: unsavedCount, rows: unsaved.map((d) => ({ ...who(d), count: Number(d.app.unsaved_answers) })) },
    todo: 'Every other section is only as good as this. Start the confirm flow.',
    howCounted: 'Rows with unconfirmed fields; sent rows whose CV on file is not marked as the exact file sent; answers recorded as given but never saved.',
  };

  // I10 Pay you've seen
  const paid = base.filter((d) => d.app.salary_text || d.app.salary_min != null || d.app.salary_max != null);
  /** @type {Map<string, any>} */
  const payGroups = new Map();
  const unparsed = [];
  for (const d of paid) {
    const row = { ...who(d), text: d.app.salary_text ?? null, min: d.app.salary_min ?? null, max: d.app.salary_max ?? null, display: formatSalary(d.app) };
    if (!d.app.salary_currency || (d.app.salary_min == null && d.app.salary_max == null)) { unparsed.push(row); continue; }
    const key = `${d.app.salary_currency}/${d.app.salary_period ?? ''}`;
    const g = payGroups.get(key) ?? { currency: d.app.salary_currency, period: d.app.salary_period ?? null, rows: [] };
    g.rows.push(row);
    payGroups.set(key, g);
  }
  const i10 = {
    id: 'i10', question: "Pay you've seen",
    answer: paid.length ? `${paid.length} postings stated pay; not converted between currencies.` : 'No posting stated pay yet.',
    n: paid.length, display: 'counts',
    groups: [...payGroups.values()].sort((a, b) => b.rows.length - a.rows.length || String(a.currency).localeCompare(String(b.currency))),
    unparsed,
    todo: 'Reference only.',
    howCounted: 'Salary as written in each posting, grouped by currency and period. Never converted or averaged.',
  };

  // actions for `intervous insights --only actions`
  const t = buildToday(input);
  const actions = t.items.flatMap((it) => itemToActions(it, t.today));

  return {
    generatedOn: today,
    window: windowMode,
    windowLabel: windowMode === 'all' ? 'All' : `Since ${formatShort(settings.campaign_start, { withYear: true })}`,
    onlyConfirmed: Boolean(opts.onlyConfirmed),
    unconfirmedInScope,
    badge: unconfirmedInScope && !opts.onlyConfirmed ? `includes ${unconfirmedInScope} unconfirmed` : null,
    intro,
    sample,
    sections: [i1, i2, i3, i4, i5, i6, i7, i8, i9, i10],
    i1, i2, i3, i4, i5, i6, i7, i8, i9, i10,
    older: {
      count: olderRows.length, label: 'Older records', note: 'incomplete, not comparable',
      funnel: fOld, rows: olderRows.map((d) => ({ ...who(d), appliedOn: d.appliedOn, unconfirmed: d.unconfirmed })),
    },
    actions,
  };
}

/**
 * `intervous insights --json` without `--only`: one object per insight with n, allowed_display and the numbers.
 * @param {import('./derive.mjs').CoreInput} input
 * @param {InsightOptions} [opts]
 */
export function insightsForCli(input, opts = {}) {
  const r = computeInsights(input, opts);
  return {
    generated_on: r.generatedOn,
    window: r.window,
    intro: r.intro,
    sample: r.sample,
    insights: r.sections.map((s) => {
      const { id, question, answer, n, display, todo, howCounted, ...numbers } = s;
      return { id, question, answer, n, allowed_display: display, what_to_do: todo, how_counted: howCounted, numbers };
    }),
    older: r.older,
    actions: r.actions,
  };
}
