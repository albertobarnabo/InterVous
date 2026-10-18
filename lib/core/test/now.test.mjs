import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nowSentence, buildStepper, waitingDays, phaseChangedOn } from '../now.mjs';
import { buildContext, listGroupOf } from '../derive.mjs';

const fx = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const ctx = { today: fx.today, events: fx.events, settings: fx.settings };
const app = (ref) => fx.apps.find((a) => a.slug === ref || String(a.id) === String(ref));

test('now sentence for every fixture row', () => {
  const expected = {
    91: 'Rejected, date unknown.',
    121: 'No reply after 179 days.',
    122: 'Rejected, date unknown.',
    125: 'Rejected, date unknown.',
    126: 'Rejected, date unknown.',
    'openai-codex-core-agent': 'No reply after 48 days.',
    'apple-developer-publications': 'Nothing logged since 9 Sep.',
    'anthropic-applied-ai-architect': 'No reply after 48 days.',
    'cohere-fde-agentic-platform': 'No reply after 48 days.',
    'gresearch-applied-ai-engineer': 'No reply after 48 days.',
    'langchain-deployed-engineer': 'No reply after 48 days.',
    'ai-futures-senior-ai-product-engineer-frankfurt': 'CV built 32 days ago. Not sent.',
    'ecb-tin-ssm-governance-operations': 'Sent, date unknown.',
    'ecb-14417-it-application-development-specialists': 'Sent 16 days ago. No reply yet.',
    'ecb-13745-data-science-specialist': 'Sent 17 days ago. No reply yet.',
    'posthog-product-engineer': 'Sent 16 days ago. No reply yet.',
    'openai-applied-ai-digital-natives': 'CV built 6 days ago. Not sent. The posting is gone.',
    'meta-swe-ml-integrity': 'Sent 6 days ago. No reply yet.',
    'mistral-applied-ai-fde-london': 'CV built 6 days ago. Not sent.',
    'nvidia-applied-ai-munich': 'CV built today. Not sent.',
    'revolut-applied-ai-berlin': 'CV built today. Not sent.',
    'databricks-ai-fde-amsterdam': 'CV built today. Not sent.',
    'ecb-14896-assistant-reserve-list': 'Decided not to apply.',
  };
  for (const [ref, sentence] of Object.entries(expected)) assert.equal(nowSentence(app(ref), ctx), sentence, ref);
  assert.equal(Object.keys(expected).length, fx.apps.length);
});

test('now sentence: replied, recent interview event, closed phases', () => {
  const base = { id: 1, slug: 'acme-ml', company_name: 'Acme', role: 'ML Engineer', uncertain: [] };
  const t = { today: '2026-10-17' };
  const replied = { ...base, phase: 'screening', applied_on: '2026-09-01' };
  const ev = [{ job_id: 1, kind: 'reply', occurred_on: '2026-09-05', direction: 'in' }];
  assert.equal(nowSentence(replied, { ...t, events: ev }), 'Sent 1 Sep. They replied 5 Sep.');
  assert.equal(nowSentence({ ...replied, phase: 'screening' }, { ...t, events: [] }), 'Sent 1 Sep. They replied.');
  const interviewing = { ...base, phase: 'interviewing', applied_on: '2026-09-01' };
  const iev = [{ job_id: 1, kind: 'interview_scheduled', occurred_on: '2026-10-10', title: 'Round 2 booked' }];
  assert.equal(nowSentence(interviewing, { ...t, events: iev }), 'Round 2 booked, 10 Oct.');
  const rej = [{ job_id: 1, kind: 'phase_change', occurred_on: '2026-10-12', to_phase: 'rejected' }];
  assert.equal(nowSentence({ ...base, phase: 'rejected', applied_on: '2026-09-01' }, { ...t, events: rej }), 'Rejected on 12 Oct.');
  const nr = [{ job_id: 1, kind: 'phase_change', occurred_on: '2026-10-16', to_phase: 'no_reply' }];
  assert.equal(nowSentence({ ...base, phase: 'no_reply', applied_on: '2026-08-01' }, { ...t, events: nr }), 'No reply on 16 Oct.');
  assert.equal(nowSentence({ ...base, phase: 'applied', applied_on: '2026-10-16' }, { ...t, events: [] }), 'Sent yesterday. No reply yet.');
  assert.equal(nowSentence({ ...base, phase: 'draft', cv_built_on: null }, { ...t, events: [] }), 'Not sent.');
  // a future-dated inbound event is not a reply yet
  const future = [{ job_id: 1, kind: 'reply', occurred_on: '2026-10-20', direction: 'in' }];
  assert.equal(nowSentence({ ...base, phase: 'applied', applied_on: '2026-10-10' }, { ...t, events: future }), 'Sent 7 days ago. No reply yet.');
  assert.equal(phaseChangedOn('rejected', [{ kind: 'rejection', occurred_on: '2026-10-02' }]), '2026-10-02');
});

test('age bar value and list group', () => {
  assert.equal(waitingDays(app('ecb-14417-it-application-development-specialists'), ctx), 16);
  assert.equal(waitingDays(app('apple-developer-publications'), ctx), null);
  assert.equal(waitingDays(app('ecb-tin-ssm-governance-operations'), ctx), null);
  const c = buildContext(fx);
  const groups = {};
  for (const d of c.all) groups[listGroupOf(d)] = (groups[listGroupOf(d)] ?? 0) + 1;
  assert.deepEqual(groups, { older: 5, waiting: 10, interviews: 1, not_sent: 6, closed: 1 });
});

test('stepper for Apple', () => {
  const s = buildStepper(app('apple-developer-publications'), ctx);
  assert.deepEqual(s.steps.map((x) => [x.id, x.date, x.reached]), [
    ['cv_built', '2026-08-30', true],
    ['sent', '2026-08-30', true],
    ['first_reply', '2026-09-03', true],
    ['interviews', '2026-09-03', true],
    ['outcome', null, false],
  ]);
  assert.equal(s.currentIndex, 3);
  assert.deepEqual(s.gaps, [
    { from: 'cv_built', to: 'sent', days: 0 },
    { from: 'sent', to: 'first_reply', days: 4 },
    { from: 'first_reply', to: 'interviews', days: 0 },
  ]);
  const draft = buildStepper(app('databricks-ai-fde-amsterdam'), ctx);
  assert.equal(draft.currentIndex, 0);
  assert.deepEqual(draft.steps.map((x) => x.reached), [true, false, false, false, false]);
});
