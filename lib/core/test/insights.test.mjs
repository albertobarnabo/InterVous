import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeInsights, insightsForCli, extractNumbers, formatSalary } from '../insights.mjs';
import { describeRate } from '../stats.mjs';

const fx = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(fx);
const ins = computeInsights(fx);
const slugs = (rows) => rows.map((r) => r.slug);

test('sample and intro line', () => {
  assert.deepEqual(ins.sample, { tracked: 18, sent: 11, dated: 10, undated: 1, mature: 6, responded: 1, drafts: 6, unconfirmed: 16, older: 5 });
  assert.equal(ins.intro, 'Based on 11 sent applications, 6 of them old enough to judge. Too few for percentages, so most answers are counts.');
  assert.equal(ins.windowLabel, 'Since 1 Aug 2026');
  assert.equal(ins.badge, 'includes 16 unconfirmed');
  assert.deepEqual(ins.sections.map((s) => s.id), ['i1', 'i2', 'i3', 'i4', 'i5', 'i6', 'i7', 'i8', 'i9', 'i10']);
});

test('I1 who owes you a reply', () => {
  const b = Object.fromEntries(ins.i1.buckets.map((x) => [x.id, x.rows.map((r) => `${r.slug}:${r.days}${r.statusUnconfirmed ? '*' : ''}`)]));
  assert.deepEqual(b.likely_closed, [
    'anthropic-applied-ai-architect:48*', 'cohere-fde-agentic-platform:48*', 'gresearch-applied-ai-engineer:48',
    'langchain-deployed-engineer:48', 'openai-codex-core-agent:48',
  ]);
  assert.deepEqual(b.follow_up, [
    'ecb-13745-data-science-specialist:17*', 'ecb-14417-it-application-development-specialists:16', 'posthog-product-engineer:16*',
  ]);
  assert.deepEqual(b.wait, ['meta-swe-ml-integrity:6']);
  assert.deepEqual(ins.i1.undated.map((r) => [r.slug, r.statusUnconfirmed]), [['ecb-tin-ssm-governance-operations', true]]);
  assert.equal(ins.i1.answer, '9 sent applications have had no reply; 5 of them for 45 days or more. 1 more has no sent date.');
  // the spec's asterisks are the rows whose phase is unconfirmed; G-Research, LangChain and Meta
  // only have an unsure date, so they still count as unconfirmed (hollow dot) under 5.1
  assert.equal(ins.i1.rows.find((r) => r.slug === 'gresearch-applied-ai-engineer').unconfirmed, true);
  assert.equal(ins.i1.rows.find((r) => r.slug === 'openai-codex-core-agent').unconfirmed, false);
});

test('I2 replies: 1 of 6, counts only', () => {
  assert.equal(ins.i2.answer, '1 of 6 applications sent more than 3 weeks ago got a reply (Apple, 4 days).');
  assert.equal(ins.i2.n, 6);
  assert.equal(ins.i2.display, 'counts');
  assert.ok(!('p' in ins.i2.rate));
  assert.equal(ins.i2.dots.length, 6);
  assert.deepEqual(ins.i2.responders.map((r) => [r.slug, r.days]), [['apple-developer-publications', 4]]);
  assert.equal(ins.i2.tooRecent, 4);
  assert.deepEqual(slugs(ins.i2.undated), ['ecb-tin-ssm-governance-operations']);
  assert.equal(ins.i2.unconfirmedIncluded, 5);
});

test('I3 funnel: 11 -> 1 -> 1 -> 0, older records 5 -> 4 -> 3 -> 0', () => {
  assert.equal(ins.i3.line, '11 → 1 → 1 → 0');
  assert.equal(ins.i3.older.line, '5 → 4 → 3 → 0');
  assert.equal(ins.older.funnel.line, '5 → 4 → 3 → 0');
  assert.equal(ins.older.count, 5);
  for (const r of ins.i3.rates) assert.ok(!('p' in r.rate), 'no conversion percentage below n = 20');
  const all = computeInsights(fx, { window: 'all' });
  assert.equal(all.i3.line, '16 → 5 → 4 → 0');
  assert.equal(all.windowLabel, 'All');
});

test('I4 time to reply: one dot, no median', () => {
  assert.deepEqual(ins.i4.dots.map((d) => [d.slug, d.days]), [['apple-developer-publications', 4]]);
  assert.equal(ins.i4.answer, 'One reply so far: Apple, after 4 days.');
  assert.equal(ins.i4.median.allowed, false);
  assert.ok(!('value' in ins.i4.median));
  assert.equal(ins.i4.suggestion, null);
});

test('I4 threshold suggestion appears at 5 dated replies', () => {
  const s = clone();
  const replies = { 127: '2026-09-06', 129: '2026-09-09', 130: '2026-09-12', 131: '2026-09-29' }; // 7, 10, 13, 30 days
  for (const [id, on] of Object.entries(replies)) {
    s.events.push({ job_id: Number(id), kind: 'reply', direction: 'in', occurred_on: on });
    const a = s.apps.find((x) => x.id === Number(id));
    a.first_response_on = on; a.last_inbound_on = on; a.phase = 'screening';
  }
  const r = computeInsights(s);
  assert.deepEqual(r.i4.median.values, [4, 7, 10, 13, 30]);
  assert.equal(r.i4.median.value, 10);
  assert.equal(r.i4.answer, 'Median reply time: 10 days (5 replies).');
  assert.deepEqual(r.i4.suggestion, { no_reply_after_days: 21, follow_up_after_days: 13 });
});

test('I5 sending what you build', () => {
  const w = Object.fromEntries(ins.i5.weeks.map((x) => [x.start, x.series]));
  assert.equal(ins.i5.weeks.length, 12);
  assert.equal(ins.i5.weeks[0].start, '2026-07-27');
  assert.equal(ins.i5.weeks[11].start, '2026-10-12');
  assert.deepEqual(w['2026-08-24'], { built: 6, sent: 6 });
  assert.deepEqual(w['2026-09-28'], { built: 1, sent: 3 });
  assert.deepEqual(w['2026-10-05'], { built: 3, sent: 1 });
  assert.deepEqual(w['2026-10-12'], { built: 3, sent: 0 });
  assert.deepEqual(ins.i5.burst, { on: '2026-08-30', count: 6, of: 11, text: '6 of 11 sent on 30 Aug' });
  assert.equal(ins.i5.draftCount, 6);
  assert.equal(ins.i5.builtToday, 3);
  assert.deepEqual(ins.i5.drafts.map((d) => [d.slug, d.ageDays]), [
    ['ai-futures-senior-ai-product-engineer-frankfurt', 32], ['mistral-applied-ai-fde-london', 6], ['openai-applied-ai-digital-natives', 6],
    ['databricks-ai-fde-amsterdam', 0], ['nvidia-applied-ai-munich', 0], ['revolut-applied-ai-berlin', 0],
  ]);
  assert.equal(ins.i5.sentWithin14.text, '8 of 9');
  assert.equal(ins.i5.display, 'counts');
  assert.equal(ins.i5.answer, '8 of 9 CVs went out within 14 days of being built. 6 drafts are waiting, 3 built today.');
});

test('I6 gaps by topic', () => {
  const t = Object.fromEntries(ins.i6.topics.map((x) => [x.topic, x.apps.map((a) => a.slug)]));
  assert.deepEqual(Object.keys(t), ['years_experience', 'customer_facing_title', 'leadership']);
  assert.deepEqual(t.years_experience, [
    'anthropic-applied-ai-architect', 'databricks-ai-fde-amsterdam', 'nvidia-applied-ai-munich', 'openai-applied-ai-digital-natives',
    'posthog-product-engineer', 'revolut-applied-ai-berlin', 'ai-futures-senior-ai-product-engineer-frankfurt',
  ]);
  // Spec 5.4 says 4 and 3. The history supports 3 and 2 when topics are read by meaning; the spec's
  // extra hits are substring matches ("title" in Revolut's "product ownership title", "lead" in
  // ECB 14417's "Team-lead feedback").
  assert.deepEqual(t.customer_facing_title, ['anthropic-applied-ai-architect', 'mistral-applied-ai-fde-london', 'openai-applied-ai-digital-natives']);
  assert.deepEqual(t.leadership, ['meta-swe-ml-integrity', 'revolut-applied-ai-berlin']);
  assert.deepEqual(ins.i6.noLongerGaps.map((x) => [x.topic, slugs(x.apps)]), [
    ['kubernetes', ['gresearch-applied-ai-engineer', 'langchain-deployed-engineer']],
    ['scikit_learn', ['databricks-ai-fde-amsterdam']],
    ['terraform', ['ai-futures-senior-ai-product-engineer-frankfurt']],
  ]);
  const years = ins.i6.topics[0];
  assert.equal(years.label, 'Years or seniority');
  assert.deepEqual(years.byGapState, { worded_around: 1, not_claimed: 3, open: 3 });
  assert.equal(years.apps.find((a) => a.slug === 'anthropic-applied-ai-architect').outcome, 'no');
  assert.equal(years.apps.find((a) => a.slug === 'nvidia-applied-ai-munich').outcome, null);
  assert.match(ins.i6.todo, /time in industry, not a skill/);
});

test('I7 what you told each company', () => {
  const uses = Object.fromEntries(ins.i7.proofPoints.map((p) => [p.key, [p.uses, p.sentUses]]));
  // Spec: OpalZero 11, lazy-cat 9, Fiduciary 9, ECB document-pipeline eval 7, EBA parser 6.
  // With every "EBA ... parser" wording mapped to one key the EBA parser has 8 uses, and FM360 (9) is in the top too.
  assert.deepEqual(ins.i7.proofPoints.slice(0, 6).map((p) => p.key),
    ['opalzero', 'lazy-cat', 'fiduciary', 'fm360-agent', 'ecb-eba-parser', 'ecb-document-pipeline-eval']);
  assert.deepEqual(uses.opalzero, [11, 6]);
  assert.deepEqual(uses['lazy-cat'], [9, 7]);
  assert.deepEqual(uses.fiduciary, [9, 5]);
  assert.deepEqual(uses['fm360-agent'], [9, 4]);
  assert.deepEqual(uses['ecb-eba-parser'], [8, 3]);
  assert.deepEqual(uses['ecb-document-pipeline-eval'], [7, 6]);

  assert.deepEqual(ins.i7.flagged.map((f) => f.key), ['ecb-eba-parser']);
  const flags = ins.i7.flagged[0].flags;
  const wrong = flags.find((f) => f.type === 'differs_from_fact');
  assert.equal(wrong.slug, 'ecb-14417-it-application-development-specialists');
  assert.equal(wrong.phrase, '84.7% strict F1');
  assert.equal(wrong.fact, '73.8%');
  const inc = flags.find((f) => f.type === 'inconsistent');
  assert.equal(inc.metric, 'exact_match');
  assert.deepEqual(inc.values.map((v) => v.value).sort(), [73.8, 84.7]);
  const eba = ins.i7.proofPoints.find((p) => p.key === 'ecb-eba-parser');
  const told = Object.fromEntries(eba.wordings.map((x) => [x.slug, x.detail]));
  assert.equal(told['openai-applied-ai-digital-natives'], '302 cases, 93% partial credit, 73.8% exact, $0.96/doc');
  assert.equal(told['meta-swe-ml-integrity'], 'LLM classifier, precision 86.9%, recall 83.3%');

  const unv = Object.fromEntries(ins.i7.unverifiedInUse.map((p) => [p.key, [p.metricStatus, slugs(p.apps)]]));
  assert.deepEqual(unv['xjtu-tabfact'], ['unverified', ['apple-developer-publications', 'mistral-applied-ai-fde-london', 'openai-codex-core-agent']]);
  assert.equal(unv['ecb-eba-parser'][0], 'needs_care');
  assert.equal(unv['ecb-eba-parser'][1].length, 8);
});

test('I7 number extraction', () => {
  const n = (s) => extractNumbers(s).map((x) => `${x.metric}=${x.value}${x.atLeast ? '+' : ''}`);
  assert.deepEqual(n('302 cases, 93% partial credit, 73.8% exact, $0.96/doc'), ['cases=302', 'partial_credit=93', 'exact_match=73.8', 'cost_per_doc=0.96']);
  assert.deepEqual(n("IT-project answer: 'production', 84.7% strict F1"), ['exact_match=84.7']);
  assert.deepEqual(n('precision 86.9%, recall 83.3%'), ['precision=86.9', 'recall=83.3']);
  assert.deepEqual(n('300+ cases, 93%'), ['cases=300+', '%=93']);
  assert.deepEqual(n('302-case eval, React/TS workbench'), ['cases=302']);
  assert.deepEqual(n('84.7% level-overlap F1'), ['level_overlap_f1=84.7']);
  assert.deepEqual(n(null), []);
});

test('I7: after a merge the bare "93%" is flagged as unlabeled', () => {
  const s = clone();
  for (const u of s.jobProofPoints) if (u.proof_point_id === 'pp-ecb-document-pipeline-eval') u.proof_point_id = 'pp-ecb-eba-parser';
  const r = computeInsights(s);
  const eba = r.i7.proofPoints.find((p) => p.key === 'ecb-eba-parser');
  assert.equal(eba.uses, 15);
  assert.ok(eba.flags.some((f) => f.type === 'unlabeled' && f.value === '93%'));
});

test('I8 where you are aiming: every group under 10', () => {
  assert.equal(ins.i8.answer, 'Too few to compare; Apple is the only reply.');
  assert.equal(ins.i8.visa.line, 'Visa needed on 7 of the 18 roles.');
  for (const d of ins.i8.dimensions) {
    assert.equal(d.comparison.allowed, false, d.id);
    assert.equal(d.comparison.line, 'Too few to compare yet.');
    assert.deepEqual(d.comparison.statements, []);
    for (const g of d.groups) assert.ok(g.n < 10 && !('p' in g.rate));
  }
  const visa = ins.i8.dimensions.find((d) => d.id === 'visa_needed');
  assert.deepEqual(visa.groups.map((g) => [g.key, g.k, g.n]), [['needed', 1, 4], ['not_needed', 0, 2]]);
});

test('I8 states a difference only with n >= 10 per group and separate intervals', () => {
  const s = clone();
  let id = 1000;
  const add = (visa, replied, count) => {
    for (let i = 0; i < count; i++) {
      const jid = id++;
      s.apps.push({ id: jid, slug: `synthetic-${jid}`, company_name: `Co ${jid}`, role: 'Engineer', phase: replied ? 'screening' : 'applied',
        applied_on: '2026-08-20', cv_built_on: '2026-08-20', uncertain: [], visa_needed: visa, channel: 'ats', role_family: 'applied_ai_ic',
        country_code: 'DE', first_response_on: replied ? '2026-08-25' : null, last_inbound_on: replied ? '2026-08-25' : null,
        last_follow_up_on: null, last_event_on: '2026-08-20', has_cv: true, has_sent_cv: true, unsaved_answers: 0 });
    }
  };
  add(false, true, 9); add(false, false, 1);   // no visa: 9 of 10 (+ 0 of 2 from the fixture)
  add(true, false, 10);                        // visa: 1 of 14 with the fixture's 4
  const r = computeInsights(s);
  const visa = r.i8.dimensions.find((d) => d.id === 'visa_needed');
  assert.equal(visa.comparison.allowed, true);
  assert.equal(visa.comparison.statements[0].text, 'No visa needed gets replies more often than Visa needed.');
  assert.equal(r.i8.answer, 'No visa needed gets replies more often than Visa needed.');
  // role_family has a group under 10 (forward_deployed: 3), so no statement there
  assert.equal(r.i8.dimensions.find((d) => d.id === 'role_family').comparison.allowed, false);
  // with 26 mature rows I2 now shows a range, still never below 20
  assert.equal(r.i2.n, 26);
  assert.equal(r.i2.display, 'range');
  assert.match(r.i2.answer, /^10 of 26 applications sent more than 3 weeks ago got a reply \(38%, likely between \d+% and \d+%\)\.$/);
});

test('I9 can you trust these numbers', () => {
  assert.equal(ins.i9.unconfirmed.count, 16);
  assert.equal(ins.i9.cvNotMarkedSent.count, 9);
  assert.deepEqual(slugs(ins.i9.sentWithoutCv.rows).sort(), ['ecb-13745-data-science-specialist', 'ecb-14417-it-application-development-specialists']);
  assert.equal(ins.i9.unsavedAnswers.count, 16);
  assert.deepEqual(Object.fromEntries(ins.i9.unsavedAnswers.rows.map((r) => [r.slug, r.count])), {
    'ecb-14417-it-application-development-specialists': 8, 'ecb-13745-data-science-specialist': 3,
    'posthog-product-engineer': 2, 'mistral-applied-ai-fde-london': 3,
  });
});

test('I10 pay you have seen, by currency, not converted', () => {
  const g = Object.fromEntries(ins.i10.groups.map((x) => [`${x.currency}/${x.period}`, x.rows.map((r) => [r.slug, r.display])]));
  assert.deepEqual(g['USD/year'], [['openai-codex-core-agent', '$230K–385K a year'], ['langchain-deployed-engineer', '$160K–175K a year']]);
  assert.deepEqual(g['EUR/month'], [
    ['ecb-14417-it-application-development-specialists', '€4,982 a month'], ['ecb-13745-data-science-specialist', '€4,982 a month'],
  ]);
  assert.deepEqual(slugs(ins.i10.unparsed), ['posthog-product-engineer']);
  assert.match(ins.i10.unparsed[0].text, /formula/);
  assert.equal(formatSalary({ salary_min: 50, salary_max: 70, salary_currency: 'GBP', salary_period: 'hour' }), '£50–70 an hour');
  assert.equal(formatSalary({ salary_min: null, salary_max: null }), null);
});

test('no percentage anywhere a section has n < 20', () => {
  for (const s of [ins.i2, ins.i3, ins.i5, ins.i8]) {
    assert.ok(s.n < 20);
    const json = JSON.stringify(s);
    assert.doesNotMatch(json, /\d%/, s.id);
    assert.doesNotMatch(json, /"(p|low|high|percentText|rangeText)":/, s.id);
  }
  assert.doesNotMatch(ins.intro, /%/);
});

test('"Only confirmed" drops unconfirmed rows', () => {
  const r = computeInsights(fx, { onlyConfirmed: true });
  assert.equal(r.sample.tracked, 2);
  assert.deepEqual(slugs(r.i1.rows), ['openai-codex-core-agent', 'ecb-14417-it-application-development-specialists']);
  assert.equal(r.badge, null);
});

test('CLI shape carries n and allowed_display', () => {
  const c = insightsForCli(fx);
  assert.equal(c.generated_on, '2026-10-17');
  assert.equal(c.insights.length, 10);
  const i2 = c.insights.find((x) => x.id === 'i2');
  assert.deepEqual([i2.n, i2.allowed_display], [6, 'counts']);
  assert.ok(Array.isArray(c.actions) && c.actions.length > 0);
  assert.deepEqual(describeRate(1, 6), ins.i2.rate);
});
