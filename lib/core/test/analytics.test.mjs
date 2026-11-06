import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAnalytics, MAX_ROUND_STAGES } from '../analytics.mjs';

const TODAY = '2026-10-17';
const settings = { campaign_start: '2026-08-01' };
let nextId = 1;

/** An application row; applied two months ago unless told otherwise, so silent ones are past 45 days. */
function app(over = {}) {
  const id = nextId++;
  return { id, slug: `app-${id}`, company_name: `Company ${id}`, role: 'Engineer', phase: 'applied', applied_on: '2026-08-10', ...over };
}
function input(apps, events = [], over = {}) {
  return { apps, events, settings, today: TODAY, ...over };
}
let nextEvent = 1;
/** Events for one application: [kind, occurred_on] pairs. */
const evs = (row, pairs) => pairs.map(([kind, occurred_on]) => ({ id: nextEvent++, job_id: row.id, kind, occurred_on }));

/** An application with `n` booked interview rounds. */
function withRounds(n, over = {}) {
  const row = app({ phase: 'interviewing', ...over });
  return { row, events: evs(row, Array.from({ length: n }, (_, i) => ['interview_scheduled', `2026-09-${String(10 + i * 5).padStart(2, '0')}`])) };
}
function build(entries, over) {
  return computeAnalytics(input(entries.map((e) => e.row ?? e), entries.flatMap((e) => e.events ?? []), over));
}
const step = (a, from) => a.steps.find((s) => s.from === from);
const counts = (s) => ({ passed: s.passed, stopped: s.stopped, waiting: s.waiting, withdrew: s.withdrew });

test('the ladder: who reached each stage, and who went on from it', () => {
  const a = build([
    app({ phase: 'rejected' }), // stopped before an interview
    app(), // silent past the no-reply line: stopped
    app({ applied_on: '2026-10-05' }), // recent: still waiting
    app({ phase: 'withdrawn' }),
    withRounds(1, { phase: 'rejected' }), // stopped after the 1st interview
    withRounds(1), // still in it after the 1st
    withRounds(2, { phase: 'offer' }),
    app({ phase: 'draft', applied_on: null }), // never sent: not counted at all
  ]);
  assert.deepEqual(a.stages.map((s) => [s.label, s.count]), [['Sent', 7], ['1st interview', 3], ['2nd interview', 1], ['Offer', 1]]);
  assert.deepEqual(counts(step(a, 'sent')), { passed: 3, stopped: 2, waiting: 1, withdrew: 1 });
  assert.deepEqual(counts(step(a, 'round1')), { passed: 1, stopped: 1, waiting: 1, withdrew: 0 });
  assert.deepEqual(counts(step(a, 'round2')), { passed: 1, stopped: 0, waiting: 0, withdrew: 0 });
  assert.equal(step(a, 'round2').to, 'offer');
  assert.equal(step(a, 'sent').rate.countText, '3 of 5');
  assert.equal(step(a, 'sent').percent, '60%');
  assert.equal(step(a, 'round1').percent, '50%');
  assert.equal(a.intro, 'Based on 7 sent applications.');
});

test('the two answers lead with a percentage at any size, with the counts and the average', () => {
  const a = build([app({ phase: 'rejected' }), app({ phase: 'rejected' }), withRounds(1, { phase: 'rejected' }), withRounds(1, { phase: 'offer' }), withRounds(1)]);
  assert.equal(a.perInterview.value, '60%');
  assert.equal(a.perInterview.unit, 'of applications led to an interview');
  assert.equal(a.perInterview.answer, '3 of 5 applications with an outcome: about 1.7 applications for each interview.');
  assert.equal(a.perOffer.value, '50%');
  assert.equal(a.perOffer.unit, 'of interview processes ended in an offer');
  assert.equal(a.perOffer.answer, '1 of 2 interview processes with an outcome: about 2 processes for each offer.');
  assert.equal(a.perOffer.aside, '1 is still waiting for an outcome; it counts once it has one or goes quiet past your no-reply line (45 days).');
  const every = build([withRounds(1, { phase: 'offer' })]);
  assert.equal(every.perInterview.answer, '1 of 1 application with an outcome: about 1 application for each interview.');
  assert.equal(every.perOffer.answer, '1 of 1 interview process with an outcome: about 1 process for each offer.');
  assert.equal(a.smallNote, 'A percentage from fewer than 20 outcomes can still move a lot with the next one.');
});

test('from 20 outcomes the answer adds its likely range', () => {
  const entries = [...Array.from({ length: 28 }, () => app({ phase: 'rejected' })), ...Array.from({ length: 12 }, () => withRounds(1))];
  const a = build(entries);
  assert.equal(a.perInterview.value, '30%');
  assert.equal(a.perInterview.small, false);
  assert.match(a.perInterview.answer, /^12 of 40 applications with an outcome: about 3\.3 applications for each interview\. Likely between (\d+)% and (\d+)%\.$/);
  const [, low, high] = a.perInterview.answer.match(/between (\d+)% and (\d+)%/);
  assert.ok(Number(low) < 30 && Number(high) > 30, 'the range holds the percentage');
  const even = build([...Array.from({ length: 20 }, () => app({ phase: 'rejected' })), ...Array.from({ length: 5 }, () => withRounds(1))]);
  assert.equal(even.perInterview.value, '20%');
  assert.match(even.perInterview.answer, /about 5 applications for each interview/);
  const none = build(Array.from({ length: 25 }, () => app({ phase: 'rejected' })));
  assert.equal(none.perInterview.value, '0%');
  assert.match(none.perInterview.answer, /^0 of 25 applications with an outcome\. Likely between 0% and \d+%\.$/);
});

test('waiting and withdrawn applications stay out of the rate, and are named', () => {
  const a = build([withRounds(1), app({ applied_on: '2026-10-05' }), app({ applied_on: '2026-10-06' }), app({ phase: 'withdrawn' }), app({ phase: 'rejected' })]);
  assert.equal(step(a, 'sent').decided, 2);
  assert.equal(a.perInterview.aside, '2 are still waiting for an outcome; they count once they have one or go quiet past your no-reply line (45 days). You withdrew from 1.');
});

test('going quiet past the no-reply line stops an application at any stage, unless something is booked', () => {
  const oldReply = app({ phase: 'screening' });
  const newReply = app({ phase: 'screening' });
  const ghosted = app({ phase: 'interviewing' });
  const booked = app({ phase: 'interviewing' });
  const moved = app({ phase: 'interviewing' });
  const a = build([
    { row: oldReply, events: evs(oldReply, [['reply', '2026-08-15']]) },
    { row: newReply, events: evs(newReply, [['reply', '2026-10-01']]) },
    { row: ghosted, events: evs(ghosted, [['interview_scheduled', '2026-08-20']]) },
    { row: booked, events: evs(booked, [['interview_scheduled', '2026-08-20'], ['interview_scheduled', '2026-10-30']]) },
    { row: moved, events: evs(moved, [['phase_change', '2026-10-10']]) },
  ]);
  assert.deepEqual(counts(step(a, 'sent')), { passed: 3, stopped: 1, waiting: 1, withdrew: 0 });
  // after the interview, the ghosted one stopped; the one with a 2nd booked went on
  assert.deepEqual(counts(step(a, 'round1')), { passed: 1, stopped: 1, waiting: 0, withdrew: 0 });
  // a sent row with no date counts from when it was made
  const undated = build([app({ applied_on: null, created_at: '2026-08-05T10:00:00Z' })]);
  assert.deepEqual(counts(step(undated, 'sent')), { passed: 0, stopped: 1, waiting: 0, withdrew: 0 });
});

test('a 2nd and 3rd interview logged as done on the day are rounds of their own', () => {
  const row = app({ phase: 'rejected' });
  const a = build([{ row, events: evs(row, [['interview_scheduled', '2026-09-10'], ['interview_done', '2026-09-20'], ['interview_done', '2026-09-30'], ['rejection', '2026-10-05']]) }]);
  assert.deepEqual(a.stages.map((s) => [s.label, s.count]), [['Sent', 1], ['1st interview', 1], ['2nd interview', 1], ['3rd interview', 1], ['Offer', 0]]);
  assert.deepEqual(counts(step(a, 'round3')), { passed: 0, stopped: 1, waiting: 0, withdrew: 0 });
});

test('a closed application whose only booking was still ahead never had an interview', () => {
  const row = app({ phase: 'rejected' });
  const a = build([{ row, events: evs(row, [['interview_scheduled', '2026-10-30'], ['rejection', '2026-10-12']]) }]);
  assert.equal(a.stages.find((s) => s.id === 'round1').count, 0);
  assert.deepEqual(counts(step(a, 'sent')), { passed: 0, stopped: 1, waiting: 0, withdrew: 0 });
  assert.equal(a.unlogged, 0);
});

test('an offer made by a status change and then declined is still an offer', () => {
  const row = app({ phase: 'withdrawn' });
  const a = build([{ row, events: evs(row, [['interview_scheduled', '2026-09-10'], ['phase_change', '2026-09-25'], ['phase_change', '2026-09-30']]).map((e, i) => (i === 1 ? { ...e, to_phase: 'offer' } : i === 2 ? { ...e, to_phase: 'withdrawn' } : e)) }]);
  assert.equal(a.stages.at(-1).count, 1);
  assert.equal(a.perOffer.value, '100%');
});

test('a step names how many went straight to an offer', () => {
  const a = build([withRounds(1, { phase: 'offer' }), withRounds(2, { phase: 'rejected' })]);
  assert.equal(step(a, 'round1').passed, 2);
  assert.equal(step(a, 'round1').offers, 1);
  // an offer after more rounds did not go straight from an earlier one
  const later = build([withRounds(2, { phase: 'offer' })]);
  assert.deepEqual([step(later, 'sent').offers, step(later, 'round1').offers, step(later, 'round2').offers], [0, 0, 1]);
});

test('a process you withdrew from is not "still going"', () => {
  const a = build([withRounds(1, { phase: 'withdrawn' })]);
  assert.equal(a.perOffer.answer, 'No interview process has an outcome yet.');
  assert.equal(a.perOffer.aside, 'You withdrew from 1.');
});

test('an offer after the 2nd interview went on from it, and never reached a 3rd', () => {
  const a = build([withRounds(2, { phase: 'offer' }), withRounds(3, { phase: 'rejected' })]);
  assert.deepEqual(a.stages.map((s) => [s.label, s.count]), [['Sent', 2], ['1st interview', 2], ['2nd interview', 2], ['3rd interview', 1], ['Offer', 1]]);
  assert.deepEqual(counts(step(a, 'round2')), { passed: 2, stopped: 0, waiting: 0, withdrew: 0 });
  assert.deepEqual(counts(step(a, 'round3')), { passed: 0, stopped: 1, waiting: 0, withdrew: 0 });
});

test('rounds come from the History: a booking and its "done" are one round, a later "done" alone is another', () => {
  const row = app({ phase: 'interviewing' });
  const a = build([{ row, events: evs(row, [['interview_scheduled', '2026-09-10'], ['interview_done', '2026-09-10'], ['interview_done', '2026-09-20']]) }]);
  assert.deepEqual(a.stages.map((s) => s.count), [1, 1, 1, 0]);
});

test('an invitation counts as passing, even before the date; a booking after the end does not', () => {
  const open = app({ phase: 'interviewing' });
  const closed = app({ phase: 'rejected' });
  const a = build([
    { row: open, events: evs(open, [['interview_scheduled', '2026-10-01'], ['interview_scheduled', '2026-10-30']]) },
    { row: closed, events: evs(closed, [['interview_scheduled', '2026-10-01'], ['interview_scheduled', '2026-10-30']]) },
  ]);
  assert.deepEqual(a.stages.map((s) => [s.id, s.count]), [['sent', 2], ['round1', 2], ['round2', 1], ['offer', 0]]);
  assert.deepEqual(counts(step(a, 'round1')), { passed: 1, stopped: 1, waiting: 0, withdrew: 0 });
});

test('an interview with no round in the History counts up to the first interview only, whatever its outcome', () => {
  const a = build([app({ phase: 'interviewing', applied_on: '2026-10-01' }), app({ phase: 'rejected', stage: 'Technical Interview' }), app({ phase: 'offer' })]);
  assert.equal(a.stages.find((s) => s.id === 'round1').count, 3);
  assert.equal(step(a, 'sent').passed, 3);
  // none can be placed past the first interview: an offer is left out as a rejection is
  assert.deepEqual(counts(step(a, 'round1')), { passed: 0, stopped: 0, waiting: 0, withdrew: 0 });
  assert.equal(a.unlogged, 3);
  assert.equal(a.unloggedNote, '3 applications reached an interview with no round in their History, so the steps after the first interview leave them out. "Getting an offer" still counts their outcome.');
  assert.equal(a.perOffer.value, '50%');
});

test(`rounds past the ${MAX_ROUND_STAGES}th fold into one stage that leads to the offer`, () => {
  const a = build([withRounds(6, { phase: 'offer' }), withRounds(4, { phase: 'rejected' })]);
  assert.deepEqual(a.stages.map((s) => s.label), ['Sent', '1st interview', '2nd interview', '3rd interview', '4th interview or later', 'Offer']);
  assert.deepEqual(counts(step(a, 'round4')), { passed: 1, stopped: 1, waiting: 0, withdrew: 0 });
  assert.equal(step(a, 'round4').to, 'offer');
  const four = build([withRounds(4)]);
  assert.equal(four.stages.at(-2).label, '4th interview', 'no "or later" when nobody went past it');
});

test('with no interview yet the ladder still shows the first interview', () => {
  const a = build([app({ phase: 'rejected' })]);
  assert.deepEqual(a.stages.map((s) => s.id), ['sent', 'round1', 'offer']);
  assert.equal(a.perOffer.answer, 'No interview yet.');
  assert.equal(step(a, 'round1').rate, null);
});

test('older records count only under "All time", and say what they do', () => {
  const rows = [app(), app({ applied_on: '2026-05-01', phase: 'rejected' })];
  const campaign = build(rows);
  assert.equal(campaign.stages[0].count, 1);
  assert.equal(campaign.scope.note, "1 older sent application from before 1 Aug 2026 isn't counted here.");
  // a never-sent older row is no part of any rate, so the note leaves it out
  assert.equal(build([...rows, app({ phase: 'draft', applied_on: null, created_at: '2026-05-01T10:00:00Z' })]).scope.note, campaign.scope.note);
  assert.equal(campaign.window, 'campaign', 'the default');
  const everything = computeAnalytics(input(rows), { window: 'all' });
  assert.equal(everything.stages[0].count, 2);
  assert.match(everything.scope.note, /^Includes 1 older sent application from before 1 Aug 2026\. It is incomplete/);
});

test('nothing to show', () => {
  const empty = build([]);
  assert.equal(empty.hasData, false);
  const drafts = build([app({ phase: 'draft', applied_on: null, cv_built_on: '2026-10-01' })]);
  assert.equal(drafts.hasData, true);
  assert.equal(drafts.perInterview.answer, 'Nothing sent yet.');
  assert.equal(drafts.perInterview.value, '–');
  assert.equal(drafts.perInterview.unit, null);
  assert.equal(drafts.intro, null);
});
