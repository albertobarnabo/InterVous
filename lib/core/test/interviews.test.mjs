import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERVIEW_TYPES, interviewRounds, interviewTypeOf, stageReached } from '../interviews.mjs';
import { buildContext, statusGroupOf } from '../derive.mjs';
import { computeAnalytics } from '../analytics.mjs';

const TODAY = '2026-10-17';
let nextEvent = 1;
const ev = (kind, occurred_on, title = null) => ({ id: nextEvent++, job_id: 1, kind, occurred_on, title });

test('the kind of an interview comes from its title: the app\'s labels, the old tracker\'s words, keywords', () => {
  for (const t of INTERVIEW_TYPES) assert.equal(interviewTypeOf(t.label), t.id, t.label);
  assert.equal(interviewTypeOf('Technical Interview'), 'technical', 'intervous feedback --stage');
  assert.equal(interviewTypeOf('HR Interview'), 'hr');
  assert.equal(interviewTypeOf('Final Round'), 'final');
  assert.equal(interviewTypeOf('Recruiter screen'), 'hr');
  assert.equal(interviewTypeOf('System design with the team'), 'technical');
  assert.equal(interviewTypeOf('Technical screen'), 'technical', 'technical wins over a screen');
  assert.equal(interviewTypeOf('Final round with the hiring manager'), 'final');
  assert.equal(interviewTypeOf('Call with the hiring manager'), 'hiring_manager');
  assert.equal(interviewTypeOf('Take-home exercise'), 'case');
  assert.equal(interviewTypeOf('Culture fit'), 'behavioural');
  assert.equal(interviewTypeOf('Round 1 invite'), null);
  assert.equal(interviewTypeOf('Passed the screen'), null);
  assert.equal(interviewTypeOf(''), null);
  assert.equal(interviewTypeOf(null), null);
});

test('rounds carry their kind; a "done" on the booked day is that round and can lend it a kind', () => {
  const d = {
    phase: 'interviewing',
    events: [
      ev('interview_scheduled', '2026-09-10'),
      ev('interview_done', '2026-09-10', 'HR interview'),
      ev('interview_done', '2026-09-20', 'Technical interview'),
      ev('interview_scheduled', '2026-10-01', 'Final round'),
      ev('interview_scheduled', '2026-10-01', 'Case or take-home'),
    ],
  };
  assert.deepEqual(interviewRounds(d, TODAY), [
    { on: '2026-09-10', type: 'hr' },
    { on: '2026-09-20', type: 'technical' },
    { on: '2026-10-01', type: 'final' },
    { on: '2026-10-01', type: 'case' },
  ]);
  // on a closed application a booking still ahead never happened
  const closed = { phase: 'rejected', events: [ev('interview_scheduled', '2026-10-01'), ev('interview_scheduled', '2026-10-30')] };
  assert.equal(interviewRounds(closed, TODAY).length, 1);
});

test('where an application got to: the last interview by kind or round, a test, the old stage, or screening', () => {
  const at = (events, app = {}) => stageReached({ phase: 'rejected', events, app }, TODAY);
  assert.deepEqual(at([ev('interview_scheduled', '2026-09-10', 'HR interview'), ev('interview_done', '2026-09-20', 'Technical interview')]), {
    label: 'Technical interview', type: 'technical', rounds: 2, phrase: 'after the technical interview',
  });
  assert.equal(at([ev('interview_scheduled', '2026-09-10'), ev('interview_done', '2026-09-20')]).label, '2nd interview');
  assert.equal(at([ev('interview_scheduled', '2026-09-10', 'HR interview')]).phrase, 'after the HR interview', 'HR keeps its capitals');
  assert.equal(at([ev('assessment', '2026-09-10')]).label, 'Assessment');
  assert.equal(at([], { stage: 'HR Interview' }).label, 'HR interview');
  assert.equal(at([], { stage: 'Video Interview' }).label, 'Interview', 'the database writes it by default, so it says no more');
  assert.deepEqual(at([], { stage: 'Screening' }), { label: 'Screening', type: null, rounds: 0, phrase: 'at screening' });
  assert.equal(at([]).label, 'Screening');
});

test('after the interview day, with nothing booked, an application waits for the result', () => {
  const ctx = (phase, events) => buildContext({
    apps: [{ id: 1, slug: 'acme', company_name: 'Acme', role: 'Engineer', phase, applied_on: '2026-09-01' }],
    events: events.map((e) => ({ ...e, direction: 'in' })),
    today: TODAY,
  }).all[0];
  const yesterday = ctx('interviewing', [ev('interview_scheduled', '2026-10-16')]);
  assert.equal(yesterday.awaitingResult, true);
  assert.equal(yesterday.lastInterviewOn, '2026-10-16');
  assert.equal(statusGroupOf(yesterday), 'waiting');
  const todayToo = ctx('interviewing', [ev('interview_scheduled', TODAY)]);
  assert.equal(todayToo.awaitingResult, false, 'on the day itself it is still an interview');
  assert.equal(statusGroupOf(todayToo), 'interviews');
  const nextBooked = ctx('interviewing', [ev('interview_scheduled', '2026-10-10'), ev('interview_scheduled', '2026-10-24')]);
  assert.equal(nextBooked.awaitingResult, false);
  const loggedAfter = ctx('interviewing', [ev('interview_done', '2026-10-15', 'Technical interview')]);
  assert.equal(loggedAfter.awaitingResult, true, 'an interview logged as done counts too');
  const noDate = ctx('interviewing', []);
  assert.equal(noDate.awaitingResult, false, 'with no interview in the History there is nothing to wait for');
  const rejected = ctx('rejected', [ev('interview_scheduled', '2026-10-10')]);
  assert.equal(rejected.awaitingResult, false);
});

test('pass rate by kind of interview, and the kind that stops you most', () => {
  let id = 0;
  const apps = [];
  const events = [];
  const add = (phase, rounds) => {
    id += 1;
    apps.push({ id, slug: `app-${id}`, company_name: `Company ${id}`, role: 'Engineer', phase, applied_on: '2026-09-01' });
    rounds.forEach(([on, title]) => events.push({ id: nextEvent++, job_id: id, kind: 'interview_scheduled', occurred_on: on, title, direction: 'in' }));
  };
  add('rejected', [['2026-09-10', 'HR interview'], ['2026-09-20', 'Technical interview']]);
  add('offer', [['2026-09-10', 'HR interview'], ['2026-09-20', 'Technical interview']]);
  add('interviewing', [['2026-10-15', 'Technical interview']]);
  add('rejected', [['2026-09-12', 'Round 1']]);
  const a = computeAnalytics({ apps, events, settings: { campaign_start: '2026-08-01' }, today: TODAY });
  assert.deepEqual(a.byType.map((t) => [t.id, t.passed, t.stopped, t.waiting, t.percent]), [
    ['hr', 2, 0, 0, '100%'],
    ['technical', 1, 1, 1, '50%'],
  ]);
  assert.equal(a.byTypeLine, 'So far the technical interview stops you most: 1 of 2 went further.');
  assert.equal(a.untyped, 1);
  assert.match(a.untypedNote, /^1 interview has no kind yet\./);
  const one = computeAnalytics({ apps: apps.slice(0, 1), events: events.filter((e) => e.job_id === 1), settings: { campaign_start: '2026-08-01' }, today: TODAY });
  assert.equal(one.byTypeLine, 'So far the technical interview stops you most: 0 of 1 went further.');
  const none = computeAnalytics({ apps: apps.slice(3), events: events.filter((e) => e.job_id === 4), settings: { campaign_start: '2026-08-01' }, today: TODAY });
  assert.deepEqual(none.byType, []);
  assert.equal(none.byTypeLine, null);
});

test('a closed application stops counting interviews on the day it closed', () => {
  // the technical interview was booked for 10 Oct, but the rejection came on 5 Oct: it never happened
  const d = {
    phase: 'rejected',
    events: [ev('interview_scheduled', '2026-09-28', 'HR interview'), ev('interview_scheduled', '2026-10-10', 'Technical interview'), ev('rejection', '2026-10-05')],
  };
  assert.deepEqual(interviewRounds(d, TODAY).map((r) => r.type), ['hr']);
  assert.equal(stageReached(d, TODAY).label, 'HR interview', 'and it stays so as the days pass');
  assert.equal(stageReached(d, '2026-12-01').label, 'HR interview');
  const ctx = buildContext({ apps: [{ id: 1, slug: 'acme', company_name: 'Acme', role: 'Engineer', phase: 'rejected', applied_on: '2026-09-01' }], events: [ev('interview_scheduled', '2026-10-30')], today: TODAY }).all[0];
  assert.equal(ctx.nextInterviewOn, null, 'a booking ahead on a closed application will not take place');
});

test('on one day bookings and dones pair up: a done kind wins, and two dones are two rounds', () => {
  const overridden = { phase: 'interviewing', events: [ev('interview_scheduled', '2026-10-06', 'HR interview'), ev('interview_done', '2026-10-06', 'Technical interview')] };
  assert.deepEqual(interviewRounds(overridden, TODAY), [{ on: '2026-10-06', type: 'technical' }]);
  const superday = { phase: 'interviewing', events: [ev('interview_done', '2026-10-06', 'HR interview'), ev('interview_done', '2026-10-06', 'Technical interview')] };
  assert.deepEqual(interviewRounds(superday, TODAY).map((r) => r.type), ['hr', 'technical']);
});

test('a test after the last interview is where it stopped; an old interview stage beats a test', () => {
  const at = (events, app = {}) => stageReached({ phase: 'rejected', events, app }, TODAY);
  assert.equal(at([ev('interview_scheduled', '2026-10-01', 'HR interview'), ev('assessment', '2026-10-05'), ev('rejection', '2026-10-12')]).label, 'Assessment');
  assert.equal(at([ev('assessment', '2026-10-01'), ev('interview_scheduled', '2026-10-05', 'HR interview'), ev('rejection', '2026-10-12')]).label, 'HR interview');
  assert.equal(at([ev('assessment', '2026-10-01'), ev('rejection', '2026-10-12')], { stage: 'Video Interview' }).label, 'Interview');
  assert.equal(at([], { stage: 'Coding Assessment' }).label, 'Assessment');
});

test('the weakest kinds are named with their capitals, ties included', () => {
  let id = 100;
  const apps = [];
  const events = [];
  const add = (phase, titles) => {
    id += 1;
    apps.push({ id, slug: `t-${id}`, company_name: `C ${id}`, role: 'Engineer', phase, applied_on: '2026-09-01' });
    titles.forEach((title, i) => events.push({ id: nextEvent++, job_id: id, kind: 'interview_scheduled', occurred_on: `2026-09-${10 + i * 5}`, title, direction: 'in' }));
  };
  add('rejected', ['HR interview']);
  add('rejected', ['HR interview']);
  add('offer', ['HR interview', 'Technical interview']);
  const one = computeAnalytics({ apps, events, settings: { campaign_start: '2026-08-01' }, today: TODAY });
  assert.equal(one.byTypeLine, 'So far the HR interview stops you most: 1 of 3 went further.');
  // a tie at the bottom names both
  apps.splice(0, apps.length);
  add('rejected', ['Final round']);
  add('rejected', ['Case or take-home']);
  add('offer', ['Technical interview']);
  add('offer', ['Technical interview']);
  const tie = computeAnalytics({ apps, events, settings: { campaign_start: '2026-08-01' }, today: TODAY });
  assert.equal(tie.byTypeLine, 'So far the case or take-home and the final round stop you most.');
});
