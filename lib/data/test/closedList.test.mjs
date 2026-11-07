// node --test: the Closed group of /applications: why each row closed, the chips' counts, and paging.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import './support.mjs';

const { buildItems, closedReasons, closedView, paginate, CLOSED_PAGE_SIZE } = await import('../../../src/features/applications/model.ts');

const TODAY = '2026-10-17';
let id = 0;
let ev = 0;
/** A row as useApplications gives it: the job_overview columns plus its events. */
function row(phase, interviews = [], extra = {}) {
  id += 1;
  const events = interviews.map(([on, title]) => ({ id: (ev += 1), job_id: id, kind: 'interview_scheduled', occurred_on: on, title, direction: 'in' }));
  return { id, slug: `app-${id}`, company_name: `Company ${id}`, role: 'Engineer', phase, applied_on: '2026-09-01', events, ...extra };
}
const items = (rows) => buildItems(rows, undefined, TODAY);

test('each closed row says why it closed; the other groups have no reason', () => {
  const list = items([
    row('rejected'),
    row('rejected', [['2026-09-10', 'HR interview']]),
    row('rejected', [['2026-09-10', 'HR interview'], ['2026-09-20', 'Technical interview']]),
    row('rejected', [['2026-09-10', null], ['2026-09-20', null]]),
    row('rejected', [], { stage: 'Video Interview' }),
    row('no_reply'),
    row('withdrawn'),
    row('skipped', [], { applied_on: null }),
    row('applied'),
  ]);
  assert.deepEqual(list.map((it) => it.closedReason?.label ?? null), [
    'Rejected at screening',
    'Rejected after HR interview',
    'Rejected after technical interview',
    'Rejected after 2nd interview',
    'Rejected after an interview',
    'No reply',
    'Withdrawn',
    'Not applying',
    null,
  ]);
  assert.equal(list[0].closedReason.id, 'rejected-screening');
});

test('the chips list each reason once, earliest stage first, with its count', () => {
  const list = items([
    row('no_reply'),
    row('rejected', [['2026-09-10', 'Technical interview']]),
    row('rejected'),
    row('rejected', [['2026-09-10', 'HR interview']]),
    row('rejected'),
    row('rejected', [['2026-09-10', null], ['2026-09-20', null]]),
    row('applied'),
  ]);
  // an interview of unknown kind is placed by its round, before the kinds
  assert.deepEqual(closedReasons(list).map((r) => [r.label, r.count]), [
    ['Rejected at screening', 2],
    ['Rejected after 2nd interview', 1],
    ['Rejected after HR interview', 1],
    ['Rejected after technical interview', 1],
    ['No reply', 1],
  ]);
});

test('a chosen reason filters the rows; one no row has any more shows them all', () => {
  const list = items([row('no_reply'), row('rejected'), row('rejected')]);
  const chosen = closedView(list, 'rejected-screening', 1);
  assert.equal(chosen.active, 'rejected-screening');
  assert.equal(chosen.filtered.length, 2);
  const stale = closedView(list, 'withdrawn', 1);
  assert.equal(stale.active, '');
  assert.equal(stale.filtered.length, 3);
});

test(`pages of ${CLOSED_PAGE_SIZE}: the range shown, and a page past the end shows the last one`, () => {
  const rows = Array.from({ length: 23 }, (_, i) => i + 1);
  assert.deepEqual(paginate(rows, 1), { items: rows.slice(0, 10), page: 1, pages: 3, from: 1, to: 10, total: 23 });
  assert.deepEqual(paginate(rows, 3), { items: rows.slice(20), page: 3, pages: 3, from: 21, to: 23, total: 23 });
  assert.equal(paginate(rows, 9).page, 3, 'a stale ?page= after rows were deleted');
  assert.equal(paginate(rows, 0).page, 1);
  assert.equal(paginate(rows, Number.NaN).page, 1);
  assert.deepEqual(paginate([], 4), { items: [], page: 1, pages: 1, from: 0, to: 0, total: 0 });
  assert.equal(paginate(rows.slice(0, 10), 1).pages, 1, 'exactly ten fit on one page');
});
