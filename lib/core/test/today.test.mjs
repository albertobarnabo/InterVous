import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildToday, todayActions, beforeInterviewChecks } from '../today.mjs';

const fx = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(fx);
const byType = (t, type) => t.items.filter((it) => it.type === type);

test('header line', () => {
  const t = buildToday(fx);
  assert.equal(t.heading, 'Today · Sat 17 Oct');
  assert.equal(t.summary.line, '11 sent · 1 interviewing · 6 not sent · last sent 6 days ago');
  assert.equal(t.summary.lastSentOn, '2026-10-11');
});

test('queue right after the import, in priority order', () => {
  const t = buildToday(fx);
  assert.deepEqual(t.items.map((it) => it.type),
    ['outcome_missing', 'confirm_facts', 'follow_up', 'no_reply', 'posting_closed', 'stale_draft', 'fix_base_cv']);
  assert.deepEqual(t.items.map((it) => it.rank), [2, 4, 5, 6, 8, 9, 10]);
  assert.equal(byType(t, 'interview_soon').length, 0);
  assert.equal(byType(t, 'next_action_due').length, 0);
  assert.equal(byType(t, 'closing_soon').length, 0);
  assert.equal(t.empty, false);
});

test('item 2: Apple interview outcome missing', () => {
  const [it] = byType(buildToday(fx), 'outcome_missing');
  assert.equal(it.slug, 'apple-developer-publications');
  assert.equal(it.inviteOn, '2026-09-03');
  // Spec 5.3 says 44 days: that is the age of the 3 Sep invite. The history also has a 9 Sep event
  // ("Earliest offered interview slot"), which 7.3's rules import as a note, so last_event_on = 9 Sep.
  assert.equal(it.daysSinceInvite, 44);
  assert.equal(it.lastEventOn, '2026-09-09');
  assert.equal(it.days, 38);
  assert.equal(it.action.label, 'Log outcome');
});

test('item 4: 16 of the 18 history rows have unconfirmed facts; status questions first', () => {
  const [it] = byType(buildToday(fx), 'confirm_facts');
  assert.equal(it.rows, 16);
  assert.equal(it.fields, 22);
  const kinds = it.questions.map((q) => q.kind);
  assert.deepEqual(kinds, [...kinds].sort((a, b) => ['sent', 'date', 'phase', 'other'].indexOf(a) - ['sent', 'date', 'phase', 'other'].indexOf(b)));
  const sent = it.questions.filter((q) => q.kind === 'sent').map((q) => q.slug);
  assert.deepEqual(new Set(sent), new Set([
    'anthropic-applied-ai-architect', 'cohere-fde-agentic-platform', 'posthog-product-engineer',
    'ecb-tin-ssm-governance-operations', 'ecb-13745-data-science-specialist', 'ai-futures-senior-ai-product-engineer-frankfurt',
  ]));
  assert.equal(sent.length, 6);
  const q = it.questions.find((x) => x.slug === 'anthropic-applied-ai-architect');
  assert.equal(q.text, 'Did you send Anthropic · Applied AI Architect, Industries on 30 Aug?');
  assert.deepEqual(q.options, ['yes', 'different_date', 'not_sent']);
  assert.deepEqual(q.fields, ['phase', 'applied_on']);
  const dates = it.questions.filter((x) => x.kind === 'date').map((x) => `${x.slug}:${x.fields}`);
  assert.deepEqual(dates, [
    'apple-developer-publications:applied_on', 'gresearch-applied-ai-engineer:applied_on', 'langchain-deployed-engineer:applied_on',
    'ecb-14896-assistant-reserve-list:cv_built_on', 'meta-swe-ml-integrity:applied_on',
  ]);
  // every unsure field of every row is covered by exactly one question
  const covered = it.questions.flatMap((x) => x.fields.map((f) => `${x.appId}:${f}`));
  const expected = fx.apps.filter((a) => a.slug && a.uncertain.length).flatMap((a) => a.uncertain.map((f) => `${a.id}:${f}`));
  for (const e of expected) assert.ok(covered.includes(e), `not asked: ${e}`);
});

test('item 5: follow up only ECB 14417 (contacts on file)', () => {
  const items = byType(buildToday(fx), 'follow_up');
  assert.deepEqual(items.map((x) => [x.slug, x.days, x.contactCount]), [['ecb-14417-it-application-development-specialists', 16, 2]]);
  // ECB 13745 (17 days) and PostHog (16) have no contact and no follow-up channel
  const withContact = clone();
  withContact.contacts.push({ job_id: 137, name: 'Recruiter' });
  assert.deepEqual(byType(buildToday(withContact), 'follow_up').map((x) => x.slug),
    ['ecb-14417-it-application-development-specialists', 'posthog-product-engineer']);
  // a follow-up in the last 14 days resets the silence
  const followed = clone();
  followed.events.push({ id: 9000, job_id: 135, kind: 'follow_up_sent', direction: 'out', occurred_on: '2026-10-10' });
  assert.equal(byType(buildToday(followed), 'follow_up').length, 0);
});

test('item 6: five applications silent for 48 days, one grouped row', () => {
  const [it] = byType(buildToday(fx), 'no_reply');
  assert.equal(it.reason, '5 applications, no reply for 48 days');
  assert.deepEqual(it.entries.map((e) => [e.slug, e.days]), [
    ['anthropic-applied-ai-architect', 48], ['cohere-fde-agentic-platform', 48], ['gresearch-applied-ai-engineer', 48],
    ['langchain-deployed-engineer', 48], ['openai-codex-core-agent', 48],
  ]);
  // the legacy Mistral row (179 days) is an older record and stays out
  assert.ok(!it.entries.some((e) => e.appId === 121));
  // posting gone + silent 21 days also qualifies
  const gone = clone();
  const meta = gone.apps.find((a) => a.id === 139);
  meta.applied_on = '2026-09-20'; meta.posting_live = false;
  assert.ok(byType(buildToday(gone), 'no_reply')[0].entries.some((e) => e.appId === 139 && e.postingGone));
});

test('items 8 and 9: posting closed (OpenAI DN, with the Munich repost) and stale draft (AI Futures, 32 days)', () => {
  const t = buildToday(fx);
  const [closed] = byType(t, 'posting_closed');
  assert.equal(closed.slug, 'openai-applied-ai-digital-natives');
  assert.match(closed.hint, /Munich version posted 13 Oct/);
  const stale = byType(t, 'stale_draft');
  assert.deepEqual(stale.map((x) => [x.slug, x.days]), [['ai-futures-senior-ai-product-engineer-frankfurt', 32]]);
  assert.equal(stale[0].reason, 'CV built 32 days ago, not sent');
});

test('item 10: fix the base CV (no_longer_true gaps by topic)', () => {
  const [it] = byType(buildToday(fx), 'fix_base_cv');
  // Spec 5.3 lists Kubernetes and Terraform. The 7.3 overrides also mark scikit-learn (Databricks)
  // no_longer_true ("added to CV"), so the rule lists it too.
  assert.deepEqual(it.topics.map((t) => [t.topic, t.apps.map((a) => a.slug)]), [
    ['kubernetes', ['gresearch-applied-ai-engineer', 'langchain-deployed-engineer']],
    ['scikit_learn', ['databricks-ai-fde-amsterdam']],
    ['terraform', ['ai-futures-senior-ai-product-engineer-frankfurt']],
  ]);
  assert.equal(it.topics[0].task, 'Add Kubernetes to the base CV');
  // one topic on a Saturday: hidden; on a Monday: shown
  const one = clone();
  one.requirements = one.requirements.filter((r) => !(r.gap_state === 'no_longer_true' && r.topic !== 'terraform'));
  assert.equal(byType(buildToday(one), 'fix_base_cv').length, 0);
  assert.equal(byType(buildToday({ ...one, today: '2026-10-19' }), 'fix_base_cv').length, 1);
});

test('items 1, 3 and 7 with synthetic data', () => {
  const s = clone();
  s.events.push({ id: 9001, job_id: 135, kind: 'interview_scheduled', direction: 'in', occurred_on: '2026-10-15', occurred_at: '2026-10-20T09:00:00+02:00', title: 'Written exercise' });
  s.apps.find((a) => a.id === 135).cautions = 1;
  s.apps.find((a) => a.id === 141).next_action_due = '2026-10-16';
  s.apps.find((a) => a.id === 141).next_action = 'Ask about the 5+ years bar';
  s.apps.find((a) => a.id === 143).closes_on = '2026-10-27';
  const t = buildToday(s);
  const [soon] = byType(t, 'interview_soon');
  assert.equal(soon.slug, 'ecb-14417-it-application-development-specialists');
  assert.equal(soon.days, 3);
  assert.equal(soon.reason, 'Interview in 3 days');
  assert.equal(soon.check, true);
  assert.equal(t.items[0].type, 'interview_soon');
  const [due] = byType(t, 'next_action_due');
  assert.deepEqual([due.slug, due.days, due.reason], ['nvidia-applied-ai-munich', 1, 'Ask about the 5+ years bar']);
  const [closing] = byType(t, 'closing_soon');
  assert.deepEqual([closing.slug, closing.days], ['databricks-ai-fde-amsterdam', 10]);
  assert.equal(t.comingUp.interviews[0].on, '2026-10-20');
  assert.equal(t.comingUp.closing[0].on, '2026-10-27');
  // the inbound interview event is also ECB 14417's first reply, so it no longer needs a follow-up
  assert.equal(byType(t, 'follow_up').length, 0);
});

test('"before the interview, check" callout', () => {
  // Apple is interviewing and uses the TabFact proof point, which is unverified
  const apple = beforeInterviewChecks(fx, 128);
  assert.equal(apple.show, true);
  assert.deepEqual(apple.proofPoints.map((p) => [p.key, p.metricStatus]), [['xjtu-tabfact', 'unverified']]);
  assert.deepEqual(apple.cautions, []);
  // ECB 14417 has the EBA-parser caution but is not interviewing and has no interview booked
  const ecb = beforeInterviewChecks(fx, 135);
  assert.equal(ecb.show, false);
  assert.match(ecb.cautions[0].evidence, /strict exact-match is 73\.8%/);
  assert.deepEqual(ecb.proofPoints.map((p) => [p.key, p.detail]), [['ecb-eba-parser', "IT-project answer: 'production', 84.7% strict F1"]]);
  // book an interview in 3 days and the callout shows
  const s = clone();
  s.events.push({ id: 9002, job_id: 135, kind: 'interview_scheduled', direction: 'in', occurred_on: '2026-10-20' });
  assert.equal(beforeInterviewChecks(s, 135).show, true);
  assert.equal(beforeInterviewChecks(fx, 999).show, false);
});

test('snoozed items are hidden until their date', () => {
  const t = buildToday(fx, { dismissed: { confirm_facts: '2026-10-20', 'stale_draft:133': '2026-10-01' } });
  assert.ok(!t.items.some((it) => it.type === 'confirm_facts'));
  assert.ok(t.items.some((it) => it.type === 'stale_draft'));
  assert.equal(t.hidden, 1);
});

test('empty state and replies strip', () => {
  const t = buildToday(fx);
  assert.equal(t.replies.line, '1 of 6 old enough to judge · 4 too recent');
  assert.equal(t.replies.rate.text, '1 of 6');
  assert.ok(!('p' in t.replies.rate));
  assert.deepEqual(t.replies.dots.filter((d) => d.state === 'yes').map((d) => d.slug), ['apple-developer-publications']);
  assert.equal(t.replies.dots.length, 6);
  const allDismissed = Object.fromEntries(t.items.map((it) => [it.key, '2099-01-01']));
  const quiet = buildToday(fx, { dismissed: allDismissed });
  assert.equal(quiet.empty, true);
  assert.equal(quiet.emptyLine, 'Nothing needs you. Last sent 6 days ago.');
  assert.deepEqual(t.recentlyAdded, []); // every fixture row came from the import, none from the CLI
});

test('view columns alone and raw events alone give the same queue', () => {
  const strip = (t) => t.items.map((it) => [it.type, it.slug ?? null, it.days ?? null, it.rows ?? null]);
  const expected = strip(buildToday(fx));
  // events only: the view's computed columns removed
  const eventsOnly = clone();
  for (const a of eventsOnly.apps) {
    for (const k of ['first_response_on', 'last_inbound_on', 'last_follow_up_on', 'last_event_on', 'next_interview_at']) delete a[k];
  }
  assert.deepEqual(strip(buildToday(eventsOnly)), expected);
  // view only: no events passed at all
  const { events, ...viewOnly } = clone();
  assert.ok(events.length > 0);
  assert.deepEqual(strip(buildToday(viewOnly)), expected);
});

test('CLI actions carry ready-to-run commands', () => {
  const { generated_on, actions } = todayActions(fx);
  assert.equal(generated_on, '2026-10-17');
  const apple = actions.find((a) => a.type === 'outcome_missing');
  assert.deepEqual(apple.suggested_commands, [
    'intervous log apple-developer-publications interview_done --on YYYY-MM-DD',
    'intervous log apple-developer-publications rejection --on YYYY-MM-DD',
    'intervous log apple-developer-publications offer --on YYYY-MM-DD',
  ]);
  assert.equal(actions.filter((a) => a.type === 'no_reply').length, 5);
  assert.ok(actions.find((a) => a.type === 'no_reply').suggested_commands[0].startsWith('intervous move anthropic-applied-ai-architect no_reply --on 2026-10-17'));
  assert.equal(actions.filter((a) => a.type === 'confirm').length, 17);
});
