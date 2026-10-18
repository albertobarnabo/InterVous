// Home (/home): the plain-language layer over buildToday and computeInsights.
//
//   summary   one sentence: "10 applications are waiting for a reply and 1 is at interview stage."
//   actions   "Do this now": at most 3 cards, each one plain sentence (what to do and why) and one
//             button. They are the Today queue (today.mjs) in its order; the confirm item is split
//             into small batches ("Did you send the 5 CVs made in October?").
//   tiles     the four STATUS_GROUPS with their counts (by phase alone, so a tile's number is the
//             row count of the filtered Applications list).
//   learned   at most 3 sentences from the insights. Counts only below n = 20 (stats.mjs decides).
//
// No new rule lives here: every number comes from buildContext / buildToday / computeInsights.

import { formatDay, formatShort, pluralDays, toDateOnly } from './dates.mjs';
import { STATUS_GROUPS, phaseGroup, topicLabel } from './phases.mjs';
import { buildContext, weeksOrDays } from './derive.mjs';
import { buildToday } from './today.mjs';
import { computeInsights } from './insights.mjs';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Most actions Home shows at once. */
export const HOME_MAX_ACTIONS = 3;
/** Most sentences in "What we've learned so far". */
export const HOME_MAX_LEARNED = 3;

/**
 * 'Apple', 'Apple and Meta', 'Apple, Meta and OpenAI'.
 * @param {string[]} names
 * @returns {string}
 */
export function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Distinct names, first-seen order. @param {string[]} names */
function uniq(names) {
  return [...new Set(names.filter(Boolean))];
}

/**
 * @param {number} n
 * @param {string} one
 * @param {string} many
 */
function plural(n, one, many) {
  return n === 1 ? one : many;
}

/** @param {import('./derive.mjs').Derived} d */
function who(d) {
  return { appId: d.id, slug: d.slug, ref: d.ref, company: d.company, role: d.role, phase: d.phase };
}

// ---------------------------------------------------------------------------
// Tiles and the summary sentence
// ---------------------------------------------------------------------------

/**
 * Count of applications per status group, every row included.
 * @param {import('./derive.mjs').Context} ctx
 */
export function statusCounts(ctx) {
  return STATUS_GROUPS.map((g) => ({
    id: g.id, label: g.label, short: g.short,
    count: ctx.all.filter((d) => phaseGroup(d.phase) === g.id).length,
  }));
}

/**
 * The one summary sentence under the greeting.
 * @param {{ waiting: number, interviewing: number, offers: number, notSent: number, total: number }} c
 * @returns {string}
 */
export function summarySentence(c) {
  if (c.total === 0) return 'No applications yet. Add a job to get started.';
  const parts = [];
  if (c.waiting) parts.push(`${c.waiting} ${plural(c.waiting, 'application is', 'applications are')} waiting for a reply`);
  if (c.interviewing) {
    parts.push(parts.length
      ? `${c.interviewing} ${plural(c.interviewing, 'is', 'are')} at interview stage`
      : `${c.interviewing} ${plural(c.interviewing, 'application is', 'applications are')} at interview stage`);
  }
  if (c.offers) parts.push(`you have ${c.offers === 1 ? 'an offer' : `${c.offers} offers`}`);
  if (parts.length) {
    const s = joinNames(parts);
    return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
  }
  if (c.notSent) return `Nothing is waiting for a reply. ${c.notSent} ${plural(c.notSent, 'CV is', 'CVs are')} ready to send.`;
  return 'Nothing is in progress right now.';
}

// ---------------------------------------------------------------------------
// The confirm item, split into small batches
// ---------------------------------------------------------------------------

/**
 * Split the confirm questions into batches Home can ask about in one sentence:
 *   'drafts'  CVs whose "not sent" status is unsure, one batch per month the CV was made (newest first)
 *   'sent'    sent applications whose status or sent date is unsure
 *   'other'   anything else (a CV date, another field)
 * A batch holds every question of its applications, in confirmQuestions' order.
 * @param {any[]} questions  ConfirmQuestion[] from the confirm_facts item
 * @param {import('./derive.mjs').Context} ctx
 */
export function confirmBatches(questions, ctx) {
  /** @type {Map<number, any[]>} */
  const byApp = new Map();
  for (const q of questions) byApp.set(q.appId, [...(byApp.get(q.appId) ?? []), q]);

  /** @type {Map<string, { key: string, kind: 'drafts' | 'sent' | 'other', month: string | null, appIds: number[] }>} */
  const batches = new Map();
  for (const [appId, qs] of byApp) {
    const d = ctx.byId.get(appId);
    if (!d) continue;
    const touchesPhase = qs.some((q) => q.fields.includes('phase'));
    const touchesSent = qs.some((q) => q.fields.includes('phase') || q.fields.includes('applied_on'));
    let kind, month = null;
    if (d.phase === 'draft' && touchesPhase) {
      kind = /** @type {const} */ ('drafts');
      month = d.cvBuiltOn ? d.cvBuiltOn.slice(0, 7) : null;
    } else if (d.sent && touchesSent) kind = /** @type {const} */ ('sent');
    else kind = /** @type {const} */ ('other');
    const key = kind === 'drafts' ? `drafts:${month ?? 'undated'}` : kind;
    const b = batches.get(key) ?? { key, kind, month, appIds: [] };
    b.appIds.push(appId);
    batches.set(key, b);
  }

  const order = (/** @type {{ kind: string, month: string | null }} */ b) => (b.kind === 'drafts' ? 0 : b.kind === 'sent' ? 1 : 2);
  return [...batches.values()]
    .sort((a, b) => order(a) - order(b) || String(b.month ?? '').localeCompare(String(a.month ?? '')))
    .map((b) => {
      const ids = new Set(b.appIds);
      const qs = questions.filter((q) => ids.has(q.appId));
      const apps = b.appIds.map((id) => who(/** @type {import('./derive.mjs').Derived} */ (ctx.byId.get(id))));
      const n = apps.length;
      const first = /** @type {import('./derive.mjs').Derived} */ (ctx.byId.get(b.appIds[0]));
      let text;
      if (b.kind === 'drafts') {
        const when = b.month ? ` made in ${MONTHS[Number(b.month.slice(5, 7)) - 1]}` : '';
        text = n === 1
          ? `Did you send the ${first.company} CV${when}? Confirm it so replies can be tracked.`
          : `Did you send the ${n} CVs${when}? Confirm them so replies can be tracked.`;
      } else if (b.kind === 'sent') {
        text = n === 1
          ? `Did you send the ${first.company} application on the date we have? Confirm it so the waiting time is right.`
          : `Did you send these ${n} applications on the dates we have? Confirm them so waiting times are right.`;
      } else {
        text = n === 1
          ? `One detail of the ${first.company} application needs a quick check.`
          : `${n} applications have a detail that needs a quick check.`;
      }
      return { key: `confirm_facts:${b.key}`, kind: b.kind, month: b.month, apps, questions: qs, text };
    });
}

// ---------------------------------------------------------------------------
// "Do this now"
// ---------------------------------------------------------------------------

/**
 * @typedef {'open' | 'update' | 'done' | 'confirm' | 'copy_follow_up' | 'mark_no_reply' | 'mark_sent' | 'drop' | 'checklist_done'} HomeButtonId
 */

/** First URL in a sentence, if any. @param {string | null | undefined} text */
function firstUrl(text) {
  return text?.match(/https?:\/\/[^\s)]+/)?.[0] ?? null;
}

/** What the base-CV topics should say in a sentence ('years or seniority' reads badly). */
const TOPIC_PHRASE = /** @type {Record<string, string>} */ ({
  years_experience: 'more years of experience',
  customer_facing_title: 'a customer-facing job title',
  leadership: 'leadership experience',
});

/**
 * The Home cards for one Today item (several for the confirm item, one batch each).
 * @param {any} item  a TodayItem
 * @param {import('./derive.mjs').Context} ctx
 * @returns {any[]}
 */
export function homeActionsFor(item, ctx) {
  const today = ctx.today;
  const fmt = (/** @type {string | null} */ x) => formatShort(x, { today });
  const app = 'appId' in item ? { appId: item.appId, slug: item.slug, ref: item.ref, company: item.company, role: item.role, phase: item.phase } : null;
  const base = { key: item.key, type: item.type, app, apps: app ? [app] : [], item, link: null };
  /** @param {HomeButtonId} id @param {string} label */
  const button = (id, label) => ({ id, label });

  switch (item.type) {
    case 'interview_soon': {
      const when = item.days === 0 ? 'today' : item.days === 1 ? 'tomorrow' : `on ${formatDay(item.date)}`;
      return [{ ...base, text: `Your ${item.company} interview is ${when}. Read the CV and answers you sent them before you go.`, button: button('open', 'Get ready') }];
    }
    case 'outcome_missing':
      return [{ ...base, text: `Tell us how your ${item.company} interview went. Nothing has been noted for ${pluralDays(item.days)}.`, button: button('update', 'Update') }];
    case 'next_action_due': {
      const due = item.days === 0 ? 'It is due today.' : `It was due ${fmt(item.due)}.`;
      return [{ ...base, text: `${item.company}: ${String(item.reason).replace(/\.$/, '')}. ${due}`, button: button('done', 'Done') }];
    }
    case 'confirm_facts':
      return confirmBatches(item.questions, ctx).map((b) => ({
        ...base, key: b.key, app: b.apps.length === 1 ? b.apps[0] : null, apps: b.apps,
        questions: b.questions, text: b.text, button: button('confirm', 'Confirm'),
      }));
    case 'follow_up':
      return [{ ...base, text: `${item.company} hasn't replied in ${pluralDays(item.days)}. A short follow-up can help.`, button: button('copy_follow_up', 'Copy follow-up') }];
    case 'no_reply': {
      const names = uniq(item.entries.map((/** @type {any} */ e) => e.company));
      const n = item.entries.length;
      const days = item.entries.map((/** @type {any} */ e) => e.days);
      const lo = Math.min(...days), hi = Math.max(...days);
      const span = lo === hi ? pluralDays(lo) : `${lo} to ${hi} days`;
      const subject = names.length <= 5 && names.length === n ? joinNames(names) : `${n} applications`;
      const verb = n === 1 ? "hasn't" : "haven't";
      return [{
        ...base, app: n === 1 ? item.entries[0] : null, apps: item.entries,
        text: `${subject} ${verb} replied in ${span}. ${n === 1 ? 'It is' : 'They are'} probably closed.`,
        button: button('mark_no_reply', 'Mark as no reply'),
      }];
    }
    case 'closing_soon': {
      const when = item.days === 0 ? 'today' : item.days === 1 ? 'tomorrow' : `in ${pluralDays(item.days)}`;
      return [{ ...base, text: `The ${item.company} job closes ${when} and your CV isn't sent yet.`, button: button('mark_sent', 'Mark as sent') }];
    }
    case 'posting_closed': {
      const url = firstUrl(item.hint);
      return [{
        ...base,
        text: `The ${item.company} job post is gone and your CV was never sent. Take it off your list?`,
        link: url ? { href: url, label: 'See the newer post' } : null,
        button: button('drop', 'Not applying'),
      }];
    }
    case 'stale_draft':
      return [{ ...base, text: `Your CV for ${item.company} has been ready for ${pluralDays(item.days)}. Send it while the job is still open.`, button: button('mark_sent', 'Mark as sent') }];
    case 'fix_base_cv': {
      const labels = item.topics.map((/** @type {any} */ t) => TOPIC_PHRASE[t.topic] ?? t.label);
      const one = labels.length === 1;
      return [{
        ...base, apps: item.topics.flatMap((/** @type {any} */ t) => t.apps),
        text: `Add ${joinNames(labels)} to your main CV. You said you have ${one ? 'it' : 'them'} now, and job posts ask for ${one ? 'it' : 'them'}.`,
        button: button('checklist_done', 'Done'),
      }];
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// "What we've learned so far"
// ---------------------------------------------------------------------------

/**
 * At most 3 plain sentences from the insights. Rates go through describeRate (no percentage below 20).
 * @param {any} ins  computeInsights() result
 * @param {import('./derive.mjs').Context} ctx
 * @returns {Array<{ id: string, text: string }>}
 */
export function learnedSentences(ins, ctx) {
  /** @type {Array<{ id: string, text: string }>} */
  const out = [];
  const { settings } = ctx;

  // replies so far (I2)
  const i2 = ins.i2;
  if (i2.n > 0) {
    const k = i2.responders.length;
    const w = weeksOrDays(settings.mature_after_days);
    const names = uniq(i2.responders.map((/** @type {any} */ r) => r.company));
    let text;
    if (k === 0) text = `None of the ${i2.n} applications sent more than ${w} ago got a reply yet.`;
    else if (i2.rate.display === 'counts') {
      text = `${k} of ${i2.n} older ${plural(i2.n, 'application', 'applications')} got a reply${names.length <= 3 ? ` (${joinNames(names)})` : ''}.`;
    } else {
      text = `${i2.rate.percentText} of applications sent more than ${w} ago got a reply (${i2.rate.countText}).`;
    }
    out.push({ id: 'replies', text });
  }

  // the most common gap (I6)
  const top = ins.i6.topics[0];
  if (top && top.count >= 2) {
    out.push({ id: 'gap', text: `${top.count} job posts asked for ${TOPIC_PHRASE[top.topic] ?? topicLabel(top.topic)}.` });
  }

  // probably closed (I1)
  const likely = ins.i1.buckets.find((/** @type {any} */ b) => b.id === 'likely_closed');
  const nLikely = likely ? likely.rows.length : 0;
  if (nLikely > 0) {
    out.push({
      id: 'likely_closed',
      text: `${nLikely} ${plural(nLikely, 'application has', 'applications have')} had no reply for ${settings.no_reply_after_days}+ days and ${plural(nLikely, 'is', 'are')} probably closed.`,
    });
  }

  // fallbacks while one of the above is missing
  if (out.length < HOME_MAX_LEARNED && ins.i4.median.allowed) {
    out.push({ id: 'reply_time', text: `Replies usually come after about ${pluralDays(Math.round(ins.i4.median.value))}.` });
  }
  if (out.length < HOME_MAX_LEARNED && ins.i5.n > 0 && ins.i5.sentWithin14.display === 'counts') {
    out.push({ id: 'sent_within', text: `${ins.i5.sentWithin14.countText} CVs went out within 2 weeks of being made.` });
  }
  return out.slice(0, HOME_MAX_LEARNED);
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

/**
 * @typedef {object} HomeOptions
 * @property {Record<string, string>} [dismissed]  {actionKey: untilISO}, hidden while until >= today ("Not now")
 */

/**
 * Everything /home shows.
 * @param {import('./derive.mjs').CoreInput} input
 * @param {HomeOptions} [opts]
 */
export function buildHome(input, opts = {}) {
  const ctx = buildContext(input);
  const today = ctx.today;
  const t = buildToday(input);
  const ins = computeInsights(input);

  const tiles = statusCounts(ctx);
  const count = (/** @type {string} */ id) => tiles.find((x) => x.id === id)?.count ?? 0;
  const summary = summarySentence({
    waiting: count('waiting'),
    interviewing: ctx.all.filter((d) => d.phase === 'interviewing').length,
    offers: ctx.all.filter((d) => d.phase === 'offer').length,
    notSent: count('not_sent'),
    total: ctx.all.length,
  });

  const dismissed = opts.dismissed ?? {};
  const all = t.items.flatMap((it) => homeActionsFor(it, ctx));
  const shown = (/** @type {any} */ a) => {
    const until = toDateOnly(dismissed[a.key], ctx.settings.timezone);
    return !until || until < today;
  };
  // One confirm batch at a time: the next one takes its place once it is answered (or set aside).
  const firstConfirm = all.find((a) => a.type === 'confirm_facts' && shown(a));
  const visible = all.filter((a) => shown(a) && (a.type !== 'confirm_facts' || a === firstConfirm));
  const hiddenKeys = all.filter((a) => !shown(a)).map((a) => a.key);

  return {
    today,
    summary,
    actions: visible.slice(0, HOME_MAX_ACTIONS),
    /** Actions waiting behind the ones shown. */
    more: Math.max(0, visible.length - HOME_MAX_ACTIONS),
    /** Keys of the actions hidden with "Not now" (to bring them back). */
    hiddenKeys,
    empty: visible.length === 0,
    emptyLine: 'Nothing to do today.',
    tiles,
    learned: learnedSentences(ins, ctx),
  };
}
