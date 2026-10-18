// The Today queue (section 5.3), shared by /today and `intervous today`.
//
// Items, in priority order:
//   1 interview_soon     interview_scheduled 0-7 days ahead                        (all rows)
//   2 outcome_missing    phase interviewing, nothing logged for 14+ days           (all rows)
//   3 next_action_due    next_action_due <= today                                  (all rows)
//   4 confirm_facts      uncertain not empty; ONE grouped row with the questions   (campaign window)
//   5 follow_up          sent, silent 14..44 days, no follow-up in 14 days, posting not gone,
//                        a contact on file or channel referral/recruiter/email      (campaign window)
//   6 no_reply           applied/screening silent 45+ days, or posting gone and silent 21+;
//                        ONE grouped row                                           (campaign window)
//   7 closing_soon       draft with closes_on within 14 days                       (campaign window)
//   8 posting_closed     draft with posting_live = false (or closes_on passed)     (campaign window)
//   9 stale_draft        draft with CV built >= draft_stale_after_days ago         (campaign window)
//  10 fix_base_cv        gaps marked no_longer_true, by topic; Mondays or 2+ topics (campaign window)
//
// Rows from before campaign_start ("older records") only surface through items 1-3, which are
// explicit dates someone set, never through inferred rules.

import { daysBetween, formatShort, formatDay, weekday, pluralDays, toDateOnly } from './dates.mjs';
import { FOLLOW_UP_CHANNELS, topicLabel, WAITING_PHASES } from './phases.mjs';
import { buildContext } from './derive.mjs';
import { describeRate } from './stats.mjs';


/**
 * @param {import('./derive.mjs').Derived} d
 */
function who(d) {
  return { appId: d.id, slug: d.slug, ref: d.ref, company: d.company, role: d.role, phase: d.phase };
}

/**
 * Questions for one application. Each question lists the `fields` its answer confirms; the UI writes
 * the answer, removes those fields from `uncertain` and logs a note event, then rebuilds the list.
 *   kind 'sent'  "Did you send X on 30 Aug?"  rows that claim to be sent (applied/screening), and stale
 *                drafts, whose status is unsure. Asked first: the answer changes every count.
 *   kind 'date'  "Did you send X on 30 Aug?" / "Did you build the CV for X on 8 Sep?" for unsure dates.
 *   kind 'phase' any other unsure phase: "Is X still in interviews?", "Is X still not sent?".
 *   kind 'other' any other unsure field.
 * Options are ids the UI renders: yes, different_date, not_sent, yes_on_date, not_yet, dropped, date,
 * rejected, offer, withdrawn, sent_on_date, change.
 * @param {import('./derive.mjs').Derived} d
 * @param {string} today
 * @param {number} draftStaleAfter
 * @returns {any[]}
 */
function questionsFor(d, today, draftStaleAfter) {
  const fmt = (/** @type {string | null} */ x) => formatShort(x, { today });
  const name = `${d.company} · ${d.role}`;
  const qs = [];
  const unc = new Set(d.uncertain);
  const isWaiting = /** @type {readonly string[]} */ (WAITING_PHASES).includes(d.phase);
  const staleDraft = d.phase === 'draft' && d.draftAgeDays !== null && d.draftAgeDays >= draftStaleAfter;
  /** @param {string[]} fields */
  const take = (fields) => { for (const f of fields) unc.delete(f); return fields; };

  if (unc.has('phase') && (isWaiting || staleDraft)) {
    const fields = ['phase'];
    if (unc.has('applied_on') || (isWaiting && !d.appliedOn)) fields.push('applied_on');
    let text, options;
    if (isWaiting && d.appliedOn) {
      text = `Did you send ${name} on ${fmt(d.appliedOn)}?`;
      options = ['yes', 'different_date', 'not_sent'];
    } else if (isWaiting) {
      text = `Did you send ${name}? The date is not recorded.`;
      options = ['yes_on_date', 'not_sent'];
    } else {
      text = `Did you send ${name}? The CV was built on ${fmt(d.cvBuiltOn)}.`;
      options = ['yes_on_date', 'not_yet', 'dropped'];
    }
    qs.push({ kind: 'sent', fields: take(fields), text, options, ...who(d) });
  }
  if (d.sent && (unc.has('applied_on') || (!d.appliedOn && !qs.length))) {
    const text = d.appliedOn ? `Did you send ${name} on ${fmt(d.appliedOn)}?` : `When did you send ${name}?`;
    qs.push({ kind: 'date', fields: take(['applied_on']), text, options: d.appliedOn ? ['yes', 'different_date'] : ['date'], ...who(d) });
  }
  if (unc.has('cv_built_on')) {
    const text = d.cvBuiltOn ? `Did you build the CV for ${name} on ${fmt(d.cvBuiltOn)}?` : `When did you build the CV for ${name}?`;
    qs.push({ kind: 'date', fields: take(['cv_built_on']), text, options: d.cvBuiltOn ? ['yes', 'different_date'] : ['date'], ...who(d) });
  }
  if (unc.has('phase')) {
    const fields = ['phase'];
    if (!d.sent && unc.has('applied_on')) fields.push('applied_on');
    let text, options;
    if (d.phase === 'interviewing') {
      text = `Is ${name} still in interviews?`;
      options = ['yes', 'rejected', 'offer', 'withdrawn'];
    } else if (d.phase === 'draft') {
      text = `Is ${name} still not sent?`;
      options = ['not_sent', 'sent_on_date', 'dropped'];
    } else {
      text = `Is ${name} really ${d.phase.replace(/_/g, ' ')}?`;
      options = ['yes', 'change'];
    }
    qs.push({ kind: 'phase', fields: take(fields), text, options, ...who(d) });
  }
  for (const field of [...unc]) {
    qs.push({ kind: 'other', fields: take([field]), text: `Confirm ${field.replace(/_/g, ' ')} for ${name}.`, options: ['yes', 'change'], ...who(d) });
  }
  return qs;
}

const KIND_ORDER = /** @type {Record<string, number>} */ ({ sent: 0, date: 1, phase: 2, other: 3 });

/**
 * The confirm-flow questions (one at a time in the UI), status questions first, then dates.
 * @param {import('./derive.mjs').Derived[]} rows
 * @param {string} today
 * @param {number} draftStaleAfter
 */
export function confirmQuestions(rows, today, draftStaleAfter) {
  const qs = rows.flatMap((d) => questionsFor(d, today, draftStaleAfter).map((q) => ({ q, sortDate: d.windowDate ?? '' })));
  qs.sort((a, b) => (KIND_ORDER[a.q.kind] - KIND_ORDER[b.q.kind])
    || (a.sortDate < b.sortDate ? -1 : a.sortDate > b.sortDate ? 1 : 0)
    || a.q.company.localeCompare(b.q.company) || a.q.appId - b.q.appId);
  return qs.map(({ q }, i) => ({ key: `${q.kind}:${q.appId}:${q.fields.join('+')}`, position: i, ...q }));
}

/**
 * Caution fit items and not-verified proof points of one application.
 * @param {import('./derive.mjs').Derived} d
 * @param {import('./derive.mjs').Context} ctx
 */
function checksFor(d, ctx) {
  const cautions = (ctx.requirementsByJob.get(String(d.id)) ?? [])
    .filter((r) => r.verdict === 'caution')
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((r) => ({ requirement: r.requirement, evidence: r.evidence ?? null, topic: r.topic ?? null }));
  const ppById = new Map(ctx.proofPoints.map((p) => [String(p.id), p]));
  const proofPoints = (ctx.jobProofPointsByJob.get(String(d.id)) ?? [])
    .map((u) => ({ u, pp: ppById.get(String(u.proof_point_id)) }))
    .filter(({ pp }) => pp && (pp.metric_status ?? 'verified') !== 'verified')
    .sort((a, b) => (a.u.position ?? 0) - (b.u.position ?? 0))
    .map(({ u, pp }) => ({ key: pp.key, name: pp.name, metricStatus: pp.metric_status, caveat: pp.caveat ?? null, detail: u.detail ?? null, facts: pp.facts ?? {} }));
  return { cautions, proofPoints };
}

/**
 * The dossier's amber "Before the interview, check" callout (spec 2.3). It shows when the phase is
 * interviewing or an interview is 0-7 days away, AND the application has caution fit items or uses
 * proof points whose metric_status is not 'verified'.
 * @param {import('./derive.mjs').CoreInput} input  the application's rows (or everything)
 * @param {number | string} jobId
 */
export function beforeInterviewChecks(input, jobId) {
  const ctx = buildContext(input);
  const d = ctx.byId.get(Number(jobId));
  if (!d) return { show: false, cautions: [], proofPoints: [], interviewOn: null };
  const checks = checksFor(d, ctx);
  const soon = d.nextInterviewOn !== null && /** @type {number} */ (daysBetween(ctx.today, d.nextInterviewOn)) <= 7;
  const show = (d.phase === 'interviewing' || soon) && (checks.cautions.length + checks.proofPoints.length > 0);
  return { show, ...checks, interviewOn: d.nextInterviewOn };
}

/**
 * @typedef {object} TodayOptions
 * @property {Record<string, string>} [dismissed]  {itemKey: untilISO}: items snoozed or marked "not relevant" (localStorage iv.today.dismissed)
 */

/**
 * Build the Today page / `intervous today` output.
 * @param {import('./derive.mjs').CoreInput} input
 * @param {TodayOptions} [opts]
 */
export function buildToday(input, opts = {}) {
  const ctx = buildContext(input);
  const { settings, today } = ctx;
  const fmt = (/** @type {string | null} */ x) => formatShort(x, { today });
  const inWin = ctx.all.filter((d) => d.inWindow);
  /** @type {any[]} */
  const items = [];
  const usedDraft = new Set();

  // 1. Interview soon
  for (const d of ctx.all) {
    if (!d.nextInterviewOn) continue;
    const ahead = /** @type {number} */ (daysBetween(today, d.nextInterviewOn));
    if (ahead < 0 || ahead > 7) continue;
    const checks = checksFor(d, ctx);
    const n = checks.cautions.length + checks.proofPoints.length;
    const reason = ahead === 0 ? 'Interview today' : ahead === 1 ? 'Interview tomorrow' : `Interview in ${pluralDays(ahead)}`;
    items.push({
      rank: 1, type: 'interview_soon', key: `interview_soon:${d.id}:${d.nextInterviewOn}`, ...who(d),
      reason, evidence: `${formatDay(d.nextInterviewOn)}${n ? ` · ${n} ${n === 1 ? 'claim' : 'claims'} to check` : ''}`,
      days: ahead, date: d.nextInterviewOn, at: d.nextInterviewAt, check: n > 0,
      action: { id: 'prepare', label: 'Prepare' },
    });
  }

  // 2. Interview outcome missing
  for (const d of ctx.all) {
    if (d.phase !== 'interviewing') continue;
    const since = d.lastEventOn ?? d.appliedOn;
    const days = since ? daysBetween(since, today) : null;
    if (days === null || days < 14) continue;
    const inviteDays = d.lastInviteOn ? daysBetween(d.lastInviteOn, today) : null;
    items.push({
      rank: 2, type: 'outcome_missing', key: `outcome_missing:${d.id}`, ...who(d),
      reason: 'Interview outcome not recorded',
      evidence: `${d.lastInviteOn ? `Invite ${fmt(d.lastInviteOn)} · ` : ''}nothing logged for ${pluralDays(days)}`,
      days, lastEventOn: d.lastEventOn, inviteOn: d.lastInviteOn, daysSinceInvite: inviteDays,
      action: { id: 'log_outcome', label: 'Log outcome' },
    });
  }

  // 3. Next action due
  for (const d of ctx.all) {
    const due = toDateOnly(d.app.next_action_due);
    if (!due || due > today) continue;
    const overdue = /** @type {number} */ (daysBetween(due, today));
    items.push({
      rank: 3, type: 'next_action_due', key: `next_action_due:${d.id}:${due}`, ...who(d),
      reason: d.app.next_action || 'Next action due',
      evidence: overdue === 0 ? 'Due today' : `Due ${fmt(due)} · ${pluralDays(overdue)} overdue`,
      days: overdue, due,
      action: { id: 'done', label: 'Done' }, secondary: { id: 'reschedule', label: 'Reschedule' },
    });
  }

  // 4. Confirm facts (one grouped row)
  const unconfirmed = inWin.filter((d) => d.unconfirmed);
  if (unconfirmed.length) {
    const questions = confirmQuestions(unconfirmed, today, settings.draft_stale_after_days);
    const fields = unconfirmed.reduce((s, d) => s + d.uncertain.length, 0);
    items.push({
      rank: 4, type: 'confirm_facts', key: 'confirm_facts',
      reason: `Confirm what the history is unsure about`,
      evidence: `${unconfirmed.length} applications · ${fields} unconfirmed facts`,
      rows: unconfirmed.length, fields, questions,
      action: { id: 'start_confirm', label: 'Start' },
    });
  }

  // 5. Follow up
  for (const d of inWin) {
    if (!(/** @type {readonly string[]} */ (WAITING_PHASES).includes(d.phase))) continue;
    if (d.silenceDays === null) continue;
    if (d.silenceDays < settings.follow_up_after_days || d.silenceDays >= settings.no_reply_after_days) continue;
    if (d.lastFollowUpOn && /** @type {number} */ (daysBetween(d.lastFollowUpOn, today)) < 14) continue;
    if (d.app.posting_live === false) continue;
    const viaChannel = /** @type {readonly string[]} */ (FOLLOW_UP_CHANNELS).includes(d.app.channel);
    if (!d.hasContact && !viaChannel) continue;
    items.push({
      rank: 5, type: 'follow_up', key: `follow_up:${d.id}`, ...who(d),
      reason: d.responded ? `Nothing heard for ${pluralDays(d.silenceDays)}` : `No reply for ${pluralDays(d.silenceDays)}`,
      evidence: `Sent ${fmt(d.appliedOn)} · ${d.hasContact ? `${d.contactCount} ${d.contactCount === 1 ? 'contact' : 'contacts'} on file` : `via ${d.app.channel}`}`,
      days: d.silenceDays, contactCount: d.contactCount,
      action: { id: 'copy_follow_up', label: 'Copy a follow-up line' }, secondary: { id: 'mark_followed_up', label: 'Mark followed up' },
    });
  }

  // 6. Mark as no reply (one grouped row)
  const noReply = inWin.filter((d) => /** @type {readonly string[]} */ (WAITING_PHASES).includes(d.phase) && d.silenceDays !== null
    && (d.silenceDays >= settings.no_reply_after_days || (d.app.posting_live === false && d.silenceDays >= settings.mature_after_days)))
    .sort((a, b) => /** @type {number} */ (b.silenceDays) - /** @type {number} */ (a.silenceDays) || a.company.localeCompare(b.company));
  if (noReply.length) {
    const days = noReply.map((d) => /** @type {number} */ (d.silenceDays));
    const lo = Math.min(...days), hi = Math.max(...days);
    const span = lo === hi ? pluralDays(lo) : `${lo}–${hi} days`;
    items.push({
      rank: 6, type: 'no_reply', key: `no_reply:${noReply.map((d) => d.id).join(',')}`,
      reason: `${noReply.length} ${noReply.length === 1 ? 'application' : 'applications'}, no reply for ${span}`,
      evidence: noReply.map((d) => d.company).join(', '),
      days: hi,
      entries: noReply.map((d) => ({ ...who(d), days: d.silenceDays, appliedOn: d.appliedOn, unconfirmed: d.unconfirmed, statusUnconfirmed: d.statusUnconfirmed, postingGone: d.app.posting_live === false })),
      action: { id: 'review_no_reply', label: 'Review' },
    });
  }

  // 7. Closing soon
  for (const d of inWin) {
    if (d.phase !== 'draft') continue;
    const closes = toDateOnly(d.app.closes_on);
    if (!closes) continue;
    const ahead = /** @type {number} */ (daysBetween(today, closes));
    if (ahead < 0 || ahead > 14) continue;
    usedDraft.add(d.id);
    items.push({
      rank: 7, type: 'closing_soon', key: `closing_soon:${d.id}:${closes}`, ...who(d),
      reason: ahead === 0 ? 'Closes today, not sent' : `Closes in ${pluralDays(ahead)}, not sent`,
      evidence: `Closes ${fmt(closes)}${d.cvBuiltOn ? ` · CV built ${fmt(d.cvBuiltOn)}` : ''}`,
      days: ahead, closesOn: closes,
      action: { id: 'send_or_drop', label: 'Send or drop' },
    });
  }

  // 8. Posting closed
  for (const d of inWin) {
    if (d.phase !== 'draft' || usedDraft.has(d.id)) continue;
    const closes = toDateOnly(d.app.closes_on);
    const gone = d.app.posting_live === false || (closes !== null && closes < today);
    if (!gone) continue;
    usedDraft.add(d.id);
    const checked = toDateOnly(d.app.posting_checked_at, settings.timezone);
    items.push({
      rank: 8, type: 'posting_closed', key: `posting_closed:${d.id}`, ...who(d),
      reason: 'Posting is gone, not sent',
      evidence: d.app.next_action || (checked ? `Checked ${fmt(checked)}` : closes ? `Closed ${fmt(closes)}` : ''),
      hint: d.app.next_action ?? null,
      days: d.draftAgeDays,
      action: { id: 'drop', label: 'Drop it' }, secondary: { id: 'look_for_repost', label: 'Look for a repost' },
    });
  }

  // 9. Stale draft
  for (const d of inWin) {
    if (d.phase !== 'draft' || usedDraft.has(d.id)) continue;
    if (d.draftAgeDays === null || d.draftAgeDays < settings.draft_stale_after_days) continue;
    items.push({
      rank: 9, type: 'stale_draft', key: `stale_draft:${d.id}`, ...who(d),
      reason: `CV built ${pluralDays(d.draftAgeDays)} ago, not sent`,
      evidence: `Built ${fmt(d.cvBuiltOn)}`,
      days: d.draftAgeDays,
      action: { id: 'send_or_drop', label: 'Send or drop' },
    });
  }

  // 10. Fix the base CV
  const winIds = new Set(inWin.map((d) => String(d.id)));
  /** @type {Map<string, Set<number>>} */
  const byTopic = new Map();
  for (const r of ctx.requirements) {
    if (r.gap_state !== 'no_longer_true' || !winIds.has(String(r.job_id))) continue;
    const t = r.topic || 'other';
    const set = byTopic.get(t) ?? new Set();
    set.add(Number(r.job_id));
    byTopic.set(t, set);
  }
  if (byTopic.size && (weekday(today) === 1 || byTopic.size >= 2)) {
    const topics = [...byTopic.entries()]
      .map(([topic, ids]) => ({
        topic, label: topicLabel(topic),
        task: `Add ${topicLabel(topic)} to the base CV`,
        apps: [...ids].map((id) => ctx.byId.get(id)).filter(Boolean).map((d) => who(/** @type {import('./derive.mjs').Derived} */ (d)))
          .sort((a, b) => a.company.localeCompare(b.company)),
      }))
      .sort((a, b) => b.apps.length - a.apps.length || a.topic.localeCompare(b.topic));
    items.push({
      rank: 10, type: 'fix_base_cv', key: `fix_base_cv:${topics.map((t) => t.topic).join(',')}`,
      reason: 'Fix the base CV',
      evidence: topics.map((t) => `${t.label} (${t.apps.map((a) => a.company).join(', ')})`).join(' · '),
      topics,
      action: { id: 'open_checklist', label: 'Checklist' },
    });
  }

  // Snoozed / not relevant
  const dismissed = opts.dismissed ?? {};
  const visible = items.filter((it) => {
    const until = toDateOnly(dismissed[it.key], settings.timezone);
    return !until || until < today;
  });

  // Header line, coming up, recently added, replies so far
  const sent = inWin.filter((d) => d.sent);
  const lastSentOn = sent.reduce((/** @type {string | null} */ m, d) => (d.appliedOn && (!m || d.appliedOn > m) ? d.appliedOn : m), null);
  const lastSentDaysAgo = lastSentOn ? daysBetween(lastSentOn, today) : null;
  const interviewing = inWin.filter((d) => d.phase === 'interviewing' || d.phase === 'offer').length;
  const drafts = inWin.filter((d) => d.phase === 'draft').length;
  const lastSentText = lastSentDaysAgo === null ? 'nothing sent yet'
    : lastSentDaysAgo === 0 ? 'last sent today' : `last sent ${pluralDays(lastSentDaysAgo)} ago`;
  const summary = {
    sent: sent.length, interviewing, notSent: drafts, lastSentOn, lastSentDaysAgo,
    line: `${sent.length} sent · ${interviewing} interviewing · ${drafts} not sent · ${lastSentText}`,
  };

  const comingUp = {
    interviews: ctx.all.filter((d) => d.nextInterviewOn && /** @type {number} */ (daysBetween(today, d.nextInterviewOn)) <= 7)
      .map((d) => ({ ...who(d), on: d.nextInterviewOn, at: d.nextInterviewAt, days: daysBetween(today, d.nextInterviewOn) }))
      .sort((a, b) => /** @type {number} */ (a.days) - /** @type {number} */ (b.days)),
    closing: inWin.filter((d) => d.phase === 'draft' && d.app.closes_on).map((d) => ({ ...who(d), on: toDateOnly(d.app.closes_on), days: daysBetween(today, d.app.closes_on) }))
      .filter((x) => x.days !== null && x.days >= 0 && x.days <= 14)
      .sort((a, b) => /** @type {number} */ (a.days) - /** @type {number} */ (b.days)),
  };

  const recentlyAdded = ctx.all.filter((d) => d.app.source === 'cli')
    .sort((a, b) => String(b.app.created_at ?? b.app.updated_at ?? '').localeCompare(String(a.app.created_at ?? a.app.updated_at ?? '')))
    .slice(0, 3)
    .map((d) => ({ ...who(d), createdAt: d.app.created_at ?? null, updatedAt: d.app.updated_at ?? null, hasCv: Boolean(d.app.has_cv) }));

  const mature = inWin.filter((d) => d.mature);
  const tooRecent = inWin.filter((d) => d.dated && !d.mature).length;
  const repliesK = mature.filter((d) => d.responded).length;
  const replies = {
    rate: describeRate(repliesK, mature.length),
    tooRecent,
    undated: inWin.filter((d) => d.sent && !d.dated).length,
    dots: mature.map((d) => ({ state: d.responded ? 'yes' : 'no', unconfirmed: d.unconfirmed, label: d.company, slug: d.slug })),
    line: `${repliesK} of ${mature.length} old enough to judge · ${tooRecent} too recent`,
  };

  const emptyLine = `Nothing needs you. ${lastSentDaysAgo === null ? 'Nothing sent yet.' : lastSentDaysAgo === 0 ? 'Last sent today.' : `Last sent ${pluralDays(lastSentDaysAgo)} ago.`}`;

  return {
    today,
    heading: `Today · ${formatDay(today)}`,
    summary,
    items: visible,
    hidden: items.length - visible.length,
    empty: visible.length === 0,
    emptyLine,
    comingUp,
    recentlyAdded,
    replies,
  };
}

/**
 * Ready-to-run CLI commands for a Today item (used by `intervous insights --only actions`).
 * @param {any} item
 * @param {string} today
 * @returns {Array<{ type: string, slug: string | null, company: string | null, role: string | null, days: number | null, reason: string, suggested_commands: string[] }>}
 */
export function itemToActions(item, today) {
  const ref = (/** @type {any} */ x) => x.slug ?? String(x.appId);
  const base = (/** @type {any} */ x, /** @type {string} */ reason, /** @type {string[]} */ cmds, /** @type {number | null} */ days = x.days ?? null) => ({
    type: item.type, slug: x.slug ?? null, company: x.company ?? null, role: x.role ?? null, days, reason, suggested_commands: cmds,
  });
  switch (item.type) {
    case 'interview_soon':
      return [base(item, item.reason, [`intervous show ${ref(item)} --json`])];
    case 'outcome_missing':
      return [base(item, `${item.reason}; nothing logged for ${pluralDays(item.days)}`, [
        `intervous log ${ref(item)} interview_done --on YYYY-MM-DD`,
        `intervous log ${ref(item)} rejection --on YYYY-MM-DD`,
        `intervous log ${ref(item)} offer --on YYYY-MM-DD`,
      ])];
    case 'next_action_due':
      return [base(item, item.reason, [`intervous next ${ref(item)} --clear`, `intervous next ${ref(item)} "${String(item.reason).replace(/"/g, "'")}" --due YYYY-MM-DD`])];
    case 'confirm_facts':
      return item.questions.map((/** @type {any} */ q) => ({
        type: 'confirm', slug: q.slug, company: q.company, role: q.role, days: null, reason: q.text,
        suggested_commands: [`intervous confirm ${ref(q)} ${q.fields.join(' ')}`],
      }));
    case 'follow_up':
      return [base(item, item.reason, [`intervous log ${ref(item)} follow_up_sent --on ${today}`])];
    case 'no_reply':
      return item.entries.map((/** @type {any} */ e) => base(e, `No reply for ${pluralDays(e.days)}`, [`intervous move ${ref(e)} no_reply --on ${today}`], e.days));
    case 'closing_soon':
    case 'stale_draft':
      return [base(item, item.reason, [`intervous sent ${ref(item)} --on ${today}`, `intervous move ${ref(item)} skipped --on ${today}`])];
    case 'posting_closed':
      return [base(item, item.hint ? `${item.reason}. ${item.hint}` : item.reason, [`intervous move ${ref(item)} skipped --on ${today} --note "posting closed"`])];
    case 'fix_base_cv':
      return item.topics.map((/** @type {any} */ t) => ({
        type: 'fix_base_cv', slug: null, company: null, role: null, days: null,
        reason: `${t.task} (${t.apps.map((/** @type {any} */ a) => a.company).join(', ')})`, suggested_commands: [],
      }));
    default:
      return [];
  }
}

/**
 * `intervous insights --only actions --json`: {generated_on, actions}.
 * @param {import('./derive.mjs').CoreInput} input
 */
export function todayActions(input) {
  const t = buildToday(input);
  return { generated_on: t.today, actions: t.items.flatMap((it) => itemToActions(it, t.today)) };
}

