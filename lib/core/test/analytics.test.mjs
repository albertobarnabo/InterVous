import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAnalytics, WHERE_MAX_ROWS } from '../analytics.mjs';

const TODAY = '2026-10-17';
const settings = { campaign_start: '2026-08-01' };
let nextId = 1;

/** An application row; applied two months ago unless told otherwise. */
function app(over = {}) {
  const id = nextId++;
  return { id, slug: `app-${id}`, company_name: `Company ${id}`, role: 'Engineer', phase: 'applied', applied_on: '2026-08-10', ...over };
}
function input(apps, events = [], over = {}) {
  return { apps, events, settings, today: TODAY, ...over };
}
const total = (a, id) => a.totals.find((t) => t.id === id);
const sum = (a, series) => a.timeline.buckets.reduce((s, b) => s + b.values[series], 0);

test('totals count what happened, and agree with the funnel', () => {
  const apps = [
    app(),
    app({ phase: 'screening' }),
    app({ phase: 'interviewing' }),
    app({ phase: 'offer' }),
    app({ phase: 'rejected' }),
    app({ phase: 'no_reply' }),
    app({ phase: 'withdrawn' }),
    app({ phase: 'draft', applied_on: null, cv_built_on: '2026-10-01' }),
    app({ phase: 'skipped', applied_on: null, cv_built_on: '2026-10-01' }),
  ];
  const a = computeAnalytics(input(apps));
  assert.equal(total(a, 'sent').count, 7);
  assert.equal(total(a, 'sent').detail, 'of 9 tracked');
  assert.equal(total(a, 'replied').count, 4); // a rejection counts as a reply
  assert.equal(total(a, 'interviews').count, 2);
  assert.equal(total(a, 'offers').count, 1);
  assert.equal(total(a, 'rejected').count, 1);
  // silent for 45+ days plus the one marked no reply; a withdrawn one is not waiting on anybody
  assert.equal(total(a, 'no_reply').count, 2);
  assert.equal(total(a, 'no_reply').detail, 'silent 45+ days, or marked so');
  // a row marked no reply counts even if it heard back first, as the status card shows it
  const marked = app({ phase: 'no_reply' });
  const b = computeAnalytics(input([marked], [{ id: 1, job_id: marked.id, kind: 'reply', occurred_on: '2026-08-15' }]));
  assert.equal(total(b, 'no_reply').count, 1);
  assert.deepEqual(a.i3.steps.map((s) => s.count), [7, 4, 2, 1]);
  assert.equal(a.status.reduce((s, x) => s + x.count, 0), 9);
  assert.deepEqual(a.status.map((s) => s.phase), ['draft', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'no_reply', 'withdrawn', 'skipped']);
});

test('tiles are plain counts at any size: the one percentage on the page is the reply rate', () => {
  for (const n of [5, 25, 60]) {
    const a = computeAnalytics(input(Array.from({ length: n }, (_, i) => app({ phase: i < 5 ? 'rejected' : 'applied' }))));
    assert.equal(total(a, 'rejected').count, 5);
    assert.equal(total(a, 'rejected').detail, null);
    for (const t of a.totals) assert.doesNotMatch(String(t.detail), /%/);
  }
  const big = computeAnalytics(input(Array.from({ length: 25 }, (_, i) => app({ phase: i < 5 ? 'screening' : 'applied' }))));
  assert.match(big.i2.answer, /\(20%, likely between \d+% and \d+%\)/);
});

test('undated sends stay out of every rate', () => {
  const rows = [
    ...Array.from({ length: 15 }, (_, i) => app({ phase: i < 3 ? 'screening' : 'applied' })),
    ...Array.from({ length: 5 }, () => app({ applied_on: null, created_at: '2026-09-01T10:00:00Z' })),
  ];
  const a = computeAnalytics(input(rows));
  assert.equal(total(a, 'sent').count, 20);
  assert.equal(a.i3.rates[0].rate.text, '3 of 15');
  assert.equal(a.i2.rate.text, '3 of 15');
});

test('the funnel never divides by a smaller step, and cannot crash Home', () => {
  // Interviews past replies: bookings on rows closed with no reply, at n >= 20 where describeRate has a range to compute.
  const rows = [
    ...Array.from({ length: 20 }, () => app({ phase: 'interviewing' })),
    app({ phase: 'no_reply', stage: 'Video Interview' }),
    app({ phase: 'withdrawn', stage: 'Final Round' }),
  ];
  const a = computeAnalytics(input(rows));
  assert.deepEqual(a.i3.steps.map((s) => s.count), [22, 20, 22, 0]);
  for (const { rate } of a.i3.rates) assert.ok(rate.k <= rate.n, `${rate.k} of ${rate.n}`);
});

test('the funnel advice and the reply-rate advice cannot disagree', () => {
  const oneRejection = computeAnalytics(input(Array.from({ length: 25 }, (_, i) => app({ phase: i < 1 ? 'rejected' : 'applied' }))));
  assert.match(oneRejection.i2.todo, /^Near zero/);
  assert.equal(oneRejection.i3.todo, 'Almost no replies: work on the CV or the targeting.');
  const closedAtFinal = computeAnalytics(input([...Array.from({ length: 25 }, () => app()), app({ phase: 'no_reply', stage: 'Video Interview' })]));
  assert.equal(closedAtFinal.i3.todo, 'No replies: work on the CV or the targeting.');
  const allRejected = computeAnalytics(input(Array.from({ length: 30 }, () => app({ phase: 'rejected' }))));
  assert.equal(allRejected.i2.todo, 'Every reply so far is a rejection: work on the CV or the targeting.');
});

test('the follow-up suggestion stays between 1 day and the no-reply line, with its unit', () => {
  const replies = [1, 2, 3, 40, 50].map((days) => {
    const row = app({ phase: 'screening', applied_on: '2026-08-01' });
    const on = new Date(Date.parse('2026-08-01T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
    return { row, event: { id: days, job_id: row.id, kind: 'reply', occurred_on: on } };
  });
  const a = computeAnalytics(input(replies.map((r) => r.row), replies.map((r) => r.event)));
  assert.ok(a.i4.suggestion.follow_up_after_days < a.i4.suggestion.no_reply_after_days);
  assert.match(a.i4.todo, /follow up after about \d+ days?\.$/);
});

test('no diagnosis below the sample-size rule', () => {
  const justSent = computeAnalytics(input([app({ applied_on: '2026-10-16' })]));
  assert.equal(justSent.i3.todo, 'Too few to judge yet.');
  const drafts = computeAnalytics(input([app({ phase: 'draft', applied_on: null, cv_built_on: '2026-10-01' })]));
  assert.equal(drafts.i3.todo, 'Too few to judge yet.');
  const silent = computeAnalytics(input(Array.from({ length: 25 }, () => app())));
  assert.equal(silent.i3.todo, 'No replies: work on the CV or the targeting.');
  const replies = computeAnalytics(input(Array.from({ length: 25 }, (_, i) => app({ phase: i < 5 ? 'screening' : 'applied' }))));
  assert.equal(replies.i3.todo, 'Replies but no interviews: work on the screening stage.');
});

test('nothing sent: no "0 of 0"', () => {
  const a = computeAnalytics(input([app({ phase: 'draft', applied_on: null, cv_built_on: '2026-10-01' })]));
  assert.equal(a.hasData, true);
  assert.equal(total(a, 'sent').count, 0);
  assert.equal(a.intro, 'Nothing sent yet.');
  assert.equal(a.timeline.paceLine, 'Nothing sent yet.');
  assert.deepEqual(a.where, []);
});

test('no applications at all', () => {
  const a = computeAnalytics(input([]));
  assert.equal(a.hasData, false);
  assert.deepEqual(a.timeline.buckets, []);
  assert.deepEqual(a.status, []);
  assert.equal(a.scope.note, null);
  assert.equal(a.rejections.answer, 'No rejections so far.');
});

test('older records stay out of the default window and come in with window: all', () => {
  const apps = [
    app(),
    app({ phase: 'rejected', applied_on: '2025-10-19' }),
    app({ phase: 'rejected', applied_on: '2025-11-02' }),
    app({ phase: 'applied', applied_on: '2025-12-01' }),
  ];
  const campaign = computeAnalytics(input(apps));
  assert.equal(campaign.window, 'campaign');
  assert.equal(total(campaign, 'sent').count, 1);
  assert.equal(total(campaign, 'rejected').count, 0);
  assert.deepEqual([campaign.scope.campaign, campaign.scope.all, campaign.scope.older], [1, 4, 3]);
  assert.equal(campaign.scope.note, "3 older records from before 1 Aug 2026 aren't counted here, 2 of them rejected.");

  const all = computeAnalytics(input(apps), { window: 'all' });
  assert.equal(total(all, 'sent').count, 4);
  assert.equal(total(all, 'rejected').count, 2);
  assert.match(all.scope.note, /^Includes 3 older records from before 1 Aug 2026\./);

  const none = computeAnalytics(input([app()]));
  assert.equal(none.scope.note, null);
});

test('the timeline is weekly for a short search, with a target line and at least 8 weeks', () => {
  const a = computeAnalytics(input([
    app({ applied_on: '2026-10-05', cv_built_on: '2026-10-04' }),
    app({ applied_on: '2026-10-12' }),
    app({ applied_on: '2026-10-16' }),
  ]));
  const t = a.timeline;
  assert.equal(t.unit, 'week');
  assert.equal(t.buckets.length, 8);
  assert.equal(t.target, 3);
  assert.equal(t.buckets[t.buckets.length - 1].start, '2026-10-12');
  assert.equal(t.buckets[t.buckets.length - 1].values.sent, 2);
  assert.equal(t.buckets[t.buckets.length - 1].title, 'Week of 12 Oct');
  assert.equal(t.thisWeek, 2);
  assert.equal(t.totals.sent, 3);
  assert.equal(t.totals.built, 1);
  assert.equal(t.paceLine, '2 sent this week, target 3.');
});

test('a long span switches to months, with no target line', () => {
  const a = computeAnalytics(input([app({ applied_on: '2025-10-19' }), app({ applied_on: '2026-10-02' })]), { window: 'all' });
  const t = a.timeline;
  assert.equal(t.unit, 'month');
  assert.equal(t.target, null);
  assert.equal(t.buckets.length, 13);
  assert.equal(t.buckets[0].tick, 'Oct ’25');
  assert.equal(t.buckets[1].tick, 'Nov');
  assert.equal(t.buckets[3].tick, 'Jan ’26');
  assert.equal(t.buckets[12].title, 'October 2026');
  assert.equal(sum(a, 'sent'), 2);
});

test('what came back: each kind in its own series, future events left out', () => {
  const rejected = app({ phase: 'rejected', applied_on: '2026-09-01' });
  const interviewing = app({ phase: 'interviewing', applied_on: '2026-09-01' });
  const replied = app({ phase: 'screening', applied_on: '2026-09-01' });
  const a = computeAnalytics(input([rejected, interviewing, replied], [
    { id: 1, job_id: rejected.id, kind: 'rejection', occurred_on: '2026-09-10' },
    // the status change the rejection caused is not a second rejection
    { id: 2, job_id: rejected.id, kind: 'phase_change', to_phase: 'rejected', occurred_on: '2026-09-10' },
    { id: 3, job_id: interviewing.id, kind: 'interview_scheduled', occurred_on: '2026-09-20' },
    { id: 4, job_id: interviewing.id, kind: 'interview_scheduled', occurred_on: '2026-10-05' },
    { id: 5, job_id: interviewing.id, kind: 'interview_scheduled', occurred_on: '2026-12-01' },
    { id: 6, job_id: replied.id, kind: 'reply', occurred_on: '2026-09-05' },
    { id: 7, job_id: replied.id, kind: 'auto_ack', occurred_on: '2026-09-02' },
  ]));
  assert.deepEqual([sum(a, 'replies'), sum(a, 'interviews'), sum(a, 'rejections'), sum(a, 'offers')], [1, 2, 1, 0]);
  assert.equal(a.timeline.cameBackLine, 'So far: 1 reply, 2 interviews and 1 rejection. 1 interview is booked ahead.');
  assert.equal(a.timeline.hasCameBack, true);
});

test('an outcome recorded only as a status change still has a date', () => {
  const moved = app({ phase: 'interviewing', applied_on: '2026-09-01' });
  const a = computeAnalytics(input([moved], [
    { id: 1, job_id: moved.id, kind: 'phase_change', to_phase: 'interviewing', occurred_on: '2026-09-15' },
  ]));
  assert.equal(sum(a, 'interviews'), 1);
  assert.equal(a.timeline.undatedOutcomes, 0);
});

test('a row with no events falls back on first_response_on; one with no date at all is reported', () => {
  const viewOnly = app({ phase: 'screening', applied_on: '2026-09-01', first_response_on: '2026-09-04' });
  const noDate = app({ phase: 'rejected', applied_on: '2026-09-01' });
  const a = computeAnalytics(input([viewOnly, noDate]));
  assert.equal(sum(a, 'replies'), 1);
  assert.equal(sum(a, 'rejections'), 0);
  assert.equal(a.timeline.undatedOutcomes, 1);
  assert.equal(a.timeline.cameBackLine, 'So far: 1 reply. 1 more has no date, so it is not on this chart.');
  // ...but the tile still counts it
  assert.equal(total(a, 'rejected').count, 1);
});

test('reply time counts the replies with no exact date, so it cannot read as fewer than the tile', () => {
  const some = computeAnalytics(input([
    app({ company_name: 'Acme', phase: 'screening', applied_on: '2026-09-01', first_response_on: '2026-09-05' }),
    app({ phase: 'rejected', applied_on: '2026-09-01' }),
    app({ phase: 'rejected', applied_on: '2026-09-01' }),
  ]));
  assert.equal(total(some, 'replied').count, 3);
  assert.equal(some.replyTimeLine, '3 replies, 1 with an exact date: Acme, after 4 days.');
  const none = computeAnalytics(input([app({ phase: 'rejected' }), app({ phase: 'rejected' })]));
  assert.equal(none.replyTimeLine, "2 replies can't be timed: a date is missing or out of order.");
  assert.equal(computeAnalytics(input([app()])).replyTimeLine, 'No reply with a known date yet.');
});

test('a reply dated before sending is a bad date, not a negative wait', () => {
  const a = computeAnalytics(input([app({ company_name: 'Acme', phase: 'screening', applied_on: '2026-08-20', first_response_on: '2026-08-10' })]));
  assert.doesNotMatch(`${a.replyTimeLine} ${a.i2.answer}`, /-\d/);
  assert.equal(a.i4.dots.length, 0);
});

test('an interview booked ahead is booked, not undated, and nothing "came back" is not claimed', () => {
  const booked = app({ phase: 'interviewing', applied_on: '2026-10-01' });
  const a = computeAnalytics(input([booked], [{ id: 1, job_id: booked.id, kind: 'interview_scheduled', occurred_on: '2026-10-22' }]));
  assert.equal(total(a, 'interviews').count, 1);
  assert.equal(a.timeline.undatedOutcomes, 0);
  assert.equal(a.timeline.bookedInterviews, 1);
  assert.equal(a.timeline.cameBackLine, '1 interview is booked ahead.');
});

test('an interview dated today is on the chart, not also booked ahead; bookings ahead each count', () => {
  const today = app({ phase: 'interviewing', applied_on: '2026-10-01' });
  const a = computeAnalytics(input([today], [{ id: 1, job_id: today.id, kind: 'interview_scheduled', occurred_on: TODAY }]));
  assert.equal(a.timeline.bookedInterviews, 0);
  assert.equal(a.timeline.cameBackLine, 'So far: 1 interview.');
  const two = app({ phase: 'interviewing', applied_on: '2026-10-01' });
  const b = computeAnalytics(input([two], [
    { id: 1, job_id: two.id, kind: 'interview_scheduled', occurred_on: '2026-10-20' },
    { id: 2, job_id: two.id, kind: 'interview_scheduled', occurred_on: '2026-10-25' },
  ]));
  assert.equal(b.timeline.cameBackLine, '2 interviews are booked ahead.');
});

test('a booking on an application that closed first is named, so nothing false is claimed', () => {
  const closed = app({ phase: 'withdrawn', applied_on: '2026-10-01' });
  const a = computeAnalytics(input([closed], [{ id: 1, job_id: closed.id, kind: 'interview_scheduled', occurred_on: '2026-10-22' }]));
  assert.equal(total(a, 'interviews').count, 1);
  assert.equal(a.timeline.cameBackLine, '1 booked interview never took place.');
});

test('a move to In process that was undone is not a reply', () => {
  const row = app({ phase: 'no_reply', applied_on: '2026-08-01' });
  const a = computeAnalytics(input([row], [
    { id: 1, job_id: row.id, kind: 'phase_change', to_phase: 'screening', occurred_on: '2026-08-20' },
    { id: 2, job_id: row.id, kind: 'phase_change', to_phase: 'no_reply', occurred_on: '2026-10-17' },
  ]));
  assert.equal(total(a, 'replied').count, 0);
  assert.equal(sum(a, 'replies'), 0);
  assert.equal(a.timeline.cameBackLine, 'Nothing has come back yet.');
});

test('every outcome with no date is noted, even on a row with another dated mark', () => {
  const rejected = app({ phase: 'rejected', applied_on: '2026-09-01' });
  const offer = app({ phase: 'offer', applied_on: '2026-09-01' });
  const a = computeAnalytics(input([rejected, offer], [
    { id: 1, job_id: rejected.id, kind: 'reply', occurred_on: '2026-09-05' },
    { id: 2, job_id: offer.id, kind: 'interview_scheduled', occurred_on: '2026-09-07' },
  ]));
  assert.equal(a.timeline.undatedOutcomes, 2);
  assert.equal(a.timeline.cameBackLine, 'So far: 1 reply and 1 interview. 2 more have no date, so they are not on this chart.');
  const only = computeAnalytics(input([app({ phase: 'rejected' })]));
  assert.equal(only.timeline.cameBackLine, '1 outcome has no date, so it is not on this chart.');
});

test('interview rounds: done closes a booking; a past round logged later counts', () => {
  const rows = (events) => {
    const row = app({ phase: 'interviewing', applied_on: '2026-09-01' });
    return computeAnalytics(input([row], events.map(([kind, occurred_on], i) => ({ id: i + 1, job_id: row.id, kind, occurred_on }))));
  };
  assert.equal(sum(rows([['interview_scheduled', '2026-09-20'], ['interview_done', '2026-09-21']]), 'interviews'), 1);
  assert.equal(sum(rows([['interview_scheduled', '2026-09-20'], ['interview_done', '2026-09-21'], ['interview_done', '2026-10-05']]), 'interviews'), 2);
  assert.equal(sum(rows([['phase_change', '2026-09-20'], ['interview_done', '2026-09-22'], ['interview_done', '2026-10-05']]), 'interviews'), 2);
  // a booking with a time and a same-day "done" without one are one interview
  const timed = app({ phase: 'interviewing', applied_on: '2026-09-01' });
  const a = computeAnalytics(input([timed], [
    { id: 1, job_id: timed.id, kind: 'interview_scheduled', occurred_on: '2026-09-20', occurred_at: '2026-09-20T13:00:00Z' },
    { id: 2, job_id: timed.id, kind: 'interview_done', occurred_on: '2026-09-20', occurred_at: null },
  ]));
  assert.equal(sum(a, 'interviews'), 1);
});

test('a reply stays on its date when the application moves on, and counts once per application', () => {
  const row = app({ phase: 'interviewing', applied_on: '2026-09-01' });
  const a = computeAnalytics(input([row], [
    { id: 1, job_id: row.id, kind: 'phase_change', to_phase: 'screening', occurred_on: '2026-09-05' },
    { id: 2, job_id: row.id, kind: 'phase_change', to_phase: 'interviewing', occurred_on: '2026-09-20' },
  ]));
  assert.deepEqual([sum(a, 'replies'), sum(a, 'interviews')], [1, 1]);
  const many = app({ phase: 'screening', applied_on: '2026-09-01' });
  const b = computeAnalytics(input([many], [1, 2, 3].map((id) => ({ id, job_id: many.id, kind: 'reply', occurred_on: `2026-09-0${id + 1}` }))));
  assert.equal(sum(b, 'replies'), 1);
});

test('a booking after the rejection never happened: not a round, not "after an interview"', () => {
  const row = app({ phase: 'rejected', applied_on: '2026-09-01', stage: 'Video Interview' });
  const a = computeAnalytics(input([row], [
    { id: 1, job_id: row.id, kind: 'rejection', occurred_on: '2026-09-10' },
    { id: 2, job_id: row.id, kind: 'interview_scheduled', occurred_on: '2026-09-20' },
  ]));
  assert.equal(a.rejections.afterInterview, 0);
  assert.equal(sum(a, 'interviews'), 0);
});

test('a reopened rejection is dated by its last event; a status edit does not feed the median', () => {
  const row = app({ phase: 'rejected', applied_on: '2026-09-01' });
  const a = computeAnalytics(input([row], [
    { id: 1, job_id: row.id, kind: 'rejection', occurred_on: '2026-09-10' },
    { id: 2, job_id: row.id, kind: 'rejection', occurred_on: '2026-10-10' },
  ]));
  assert.equal(a.rejections.median.values[0], 39);
  // the newest wins, event or status change
  const moved = app({ phase: 'rejected', applied_on: '2026-09-01' });
  const m = computeAnalytics(input([moved], [
    { id: 1, job_id: moved.id, kind: 'rejection', occurred_on: '2026-09-10' },
    { id: 2, job_id: moved.id, kind: 'interview_scheduled', occurred_on: '2026-09-22' },
    { id: 3, job_id: moved.id, kind: 'phase_change', to_phase: 'rejected', occurred_on: '2026-09-30' },
  ]));
  assert.equal(m.rejections.afterInterview, 1);
  assert.equal(sum(m, 'interviews'), 1);
  const edits = Array.from({ length: 5 }, () => app({ phase: 'rejected', applied_on: '2026-09-01' }));
  const b = computeAnalytics(input(edits, edits.map((r, i) => ({ id: i + 1, job_id: r.id, kind: 'phase_change', to_phase: 'rejected', occurred_on: '2026-10-01' }))));
  assert.equal(b.rejections.median.allowed, false);
  assert.equal(sum(b, 'rejections'), 5);
});

test('axis labels stay short across New Year; the title carries the year', () => {
  const a = computeAnalytics(input([app({ applied_on: '2026-11-20' }), app({ applied_on: '2027-01-12' })], [], { today: '2027-01-20' }));
  const b = a.timeline.buckets.find((x) => x.start === '2026-11-16');
  assert.equal(b.tick, '16 Nov');
  assert.equal(b.title, 'Week of 16 Nov 2026');
});

test('the sentences read properly at one and at zero', () => {
  const oneOlder = input([app(), app({ phase: 'rejected', applied_on: '2025-10-19' })]);
  assert.equal(computeAnalytics(oneOlder).scope.note, "1 older record from before 1 Aug 2026 isn't counted here; it was rejected.");
  assert.match(computeAnalytics(oneOlder, { window: 'all' }).scope.note, /^Includes 1 older record .* It is incomplete/);
  const one = computeAnalytics(input([app()]));
  assert.match(one.intro, /^Based on 1 sent application, old enough to judge\./);
  assert.equal(one.i2.answer, 'The 1 application sent more than 3 weeks ago got no reply.');
  assert.equal(one.i1.answer, '1 sent application has had no reply for 45 days or more.');
  const undated = computeAnalytics(input([app({ applied_on: null, created_at: '2026-09-01T10:00:00Z' }), app({ applied_on: null, created_at: '2026-09-01T10:00:00Z' })]));
  assert.equal(undated.i1.answer, '2 sent applications have had no reply and have no sent date.');
  const draft = computeAnalytics(input([app({ phase: 'draft', applied_on: null, cv_built_on: '2026-10-15' })]));
  assert.equal(draft.i5.answer, '1 draft is waiting.');
  const builtAndSent = computeAnalytics(input([app({ applied_on: '2026-10-17', cv_built_on: '2026-10-17' })]));
  assert.equal(builtAndSent.i5.answer, '1 of 1 CV went out within 14 days of being built. No drafts are waiting.');
  const noDate = computeAnalytics(input([app({ applied_on: null, created_at: '2026-09-01T10:00:00Z' })]));
  assert.match(noDate.intro, /^Based on 1 sent application, with no sent date\./);
  assert.equal(noDate.i2.answer, 'No sent application has a date yet.');
  const young = computeAnalytics(input([app({ phase: 'screening', applied_on: '2026-10-14', first_response_on: '2026-10-16' })]));
  assert.match(young.i2.answer, /old enough to judge/);
  assert.doesNotMatch(young.i2.answer, /3 weeks/);
});

test('one company with several replies is named once, in a proper sentence', () => {
  const a = computeAnalytics(input([app({ company_name: 'Acme', phase: 'screening' }), app({ company_name: 'ACME ', phase: 'screening' })]));
  assert.equal(a.i8.answer, 'Too few to compare; Acme is the only company that replied.');
});

test('the comparison line names its split, uses real names, and skips unknown groups', () => {
  const rows = [
    ...Array.from({ length: 24 }, () => app({ country_code: 'DE', channel: 'ats', phase: 'screening' })),
    ...Array.from({ length: 24 }, () => app({ country_code: 'GB', channel: 'ats' })),
  ];
  assert.equal(computeAnalytics(input(rows)).whereLine, 'A clear difference by country: Germany gets replies more often than United Kingdom.');
  const close = [
    ...Array.from({ length: 12 }, (_, i) => app({ channel: 'ats', phase: i < 6 ? 'screening' : 'applied' })),
    ...Array.from({ length: 12 }, (_, i) => app({ channel: 'portal', phase: i < 6 ? 'screening' : 'applied' })),
  ];
  assert.equal(computeAnalytics(input(close)).whereLine, 'No clear difference by channel yet.');
  // a difference only against rows with no value is not "no difference", and not a finding either
  const unknown = [
    ...Array.from({ length: 12 }, () => app({ channel: 'ats', phase: 'screening' })),
    ...Array.from({ length: 12 }, () => app({ channel: null })),
  ];
  assert.equal(computeAnalytics(input(unknown)).whereLine, 'Too few to compare yet.');
  // GB and UK are one group in the sentence too
  const uk = [
    ...Array.from({ length: 12 }, () => app({ country_code: 'GB', phase: 'screening' })),
    ...Array.from({ length: 12 }, () => app({ country_code: 'UK' })),
  ];
  assert.doesNotMatch(computeAnalytics(input(uk)).whereLine, /United Kingdom .* United Kingdom/);
});

test('UK and GB are one row; the fold row cannot share a key with a company', () => {
  const uk = computeAnalytics(input([app({ country_code: 'GB' }), app({ country_code: 'UK' })]));
  assert.deepEqual(uk.where.find((w) => w.id === 'country_code').rows.map((r) => [r.label, r.sent]), [['United Kingdom', 2]]);
  const names = ['Others', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const rows = names.map((n, i) => app({ company_name: n, ...(i === 0 ? {} : {}) }));
  const keys = computeAnalytics(input([...rows, ...rows.slice(0, 1).map(() => app({ company_name: 'Others' }))])).where.find((w) => w.id === 'company').rows.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('nothing came back', () => {
  const a = computeAnalytics(input([app()]));
  assert.equal(a.timeline.cameBackLine, 'Nothing has come back yet.');
  assert.equal(a.timeline.hasCameBack, false);
});

test('undated sends are named in the pace line and left off the chart', () => {
  const a = computeAnalytics(input([app({ applied_on: '2026-10-12' }), app({ applied_on: null, created_at: '2026-09-01T10:00:00Z' })]));
  assert.equal(a.timeline.totals.sent, 1);
  assert.equal(total(a, 'sent').count, 2);
  assert.equal(a.timeline.paceLine, '1 sent this week, target 3. 1 sent application has no date, so it is not on this chart.');
});

test('rejections: before or after an interview, median only from 5 values', () => {
  const rows = [
    app({ phase: 'rejected', applied_on: '2026-09-01' }),
    app({ phase: 'rejected', applied_on: '2026-09-01' }),
    app({ phase: 'rejected', applied_on: '2026-09-01', stage: 'Final Round' }),
  ];
  const events = rows.map((r, i) => ({ id: i + 1, job_id: r.id, kind: 'rejection', occurred_on: '2026-09-11' }));
  const few = computeAnalytics(input(rows, events));
  assert.deepEqual([few.rejections.count, few.rejections.beforeInterview, few.rejections.afterInterview], [3, 2, 1]);
  assert.equal(few.rejections.answer, '3 rejections: 2 before an interview, 1 after one.');
  assert.equal(few.rejections.median.allowed, false);

  const more = [...rows, app({ phase: 'rejected', applied_on: '2026-09-01' }), app({ phase: 'rejected', applied_on: '2026-09-01' })];
  const moreEvents = more.map((r, i) => ({ id: i + 1, job_id: r.id, kind: 'rejection', occurred_on: '2026-09-11' }));
  const enough = computeAnalytics(input(more, moreEvents));
  assert.equal(enough.rejections.median.value, 10);
  assert.match(enough.rejections.answer, /They usually come about 10 days after sending \(5 with a date\)\.$/);
});

test('where: biggest group first, real country names, the tail folds', () => {
  const countries = ['DE', 'DE', 'DE', 'GB', 'GB', 'US', 'NL', 'IT', 'FR', 'ES'];
  const a = computeAnalytics(input(countries.map((c) => app({ country_code: c, channel: 'ats' }))));
  const country = a.where.find((w) => w.id === 'country_code');
  assert.equal(country.rows.length, WHERE_MAX_ROWS);
  assert.deepEqual(country.rows.slice(0, 2).map((r) => [r.label, r.sent]), [['Germany', 3], ['United Kingdom', 2]]);
  assert.deepEqual([country.rows[WHERE_MAX_ROWS - 1].label, country.rows[WHERE_MAX_ROWS - 1].sent], ['2 others', 2]);
  assert.equal(country.rows.reduce((s, r) => s + r.sent, 0), countries.length);
  assert.deepEqual(a.where.find((w) => w.id === 'channel').rows.map((r) => [r.label, r.sent]), [['Company ATS', 10]]);
});

test('where: replies are counted among applications old enough to judge', () => {
  const a = computeAnalytics(input([
    app({ country_code: 'DE', phase: 'screening', first_response_on: '2026-08-14' }),
    app({ country_code: 'DE' }),
    app({ country_code: 'DE', applied_on: '2026-10-15' }), // too recent
    app({ country_code: 'GB', applied_on: '2026-10-15' }), // too recent, nothing to judge
  ]));
  const rows = a.where.find((w) => w.id === 'country_code').rows;
  assert.equal(rows[0].sent, 3);
  assert.equal(rows[0].replied.text, '1 of 2');
  assert.equal(rows[1].replied, null);
});

test('company groups ignore case and keep the spelling first seen', () => {
  const a = computeAnalytics(input([app({ company_name: 'Acme' }), app({ company_name: 'ACME ' }), app({ company_name: 'Other' })]));
  assert.deepEqual(a.where.find((w) => w.id === 'company').rows.map((r) => [r.label, r.sent]), [['Acme', 2], ['Other', 1]]);
});

test('unconfirmed rows are counted and named', () => {
  const a = computeAnalytics(input([app({ uncertain: ['phase'] }), app()]));
  assert.equal(total(a, 'sent').count, 2);
  assert.equal(a.scope.unconfirmedNote, '1 application has details still to confirm.');
});
