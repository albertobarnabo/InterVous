import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Z80, displayFor, wilson, describeRate, intervalsOverlap, compareGroups, median, quantile, formatPercent,
} from '../stats.mjs';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('display rule: counts below 20, range 20-29, percent from 30', () => {
  for (const n of [0, 1, 5, 19]) assert.equal(displayFor(n), 'counts');
  for (const n of [20, 25, 29]) assert.equal(displayFor(n), 'range');
  for (const n of [30, 31, 200]) assert.equal(displayFor(n), 'percent');
});

test('no percentage of any kind below n = 20', () => {
  for (let n = 1; n < 20; n++) {
    for (let k = 0; k <= n; k++) {
      const r = describeRate(k, n);
      assert.equal(r.display, 'counts');
      for (const key of ['p', 'low', 'high', 'percentText', 'rangeText']) assert.ok(!(key in r), `${key} present for ${k}/${n}`);
      assert.doesNotMatch(JSON.stringify(r), /%/, `percentage leaked for ${k}/${n}`);
      assert.equal(r.text, `${k} of ${n}`);
    }
  }
});

test('Wilson 80% interval follows the spec formula', () => {
  assert.equal(Z80, 1.2816);
  const z = 1.2816, z2 = z * z;
  for (const [k, n] of [[0, 20], [1, 6], [5, 24], [9, 10], [17, 40], [30, 30]]) {
    const c = (k + z2 / 2) / (n + z2);
    const h = (z * Math.sqrt((k * (n - k)) / n + z2 / 4)) / (n + z2);
    const w = wilson(k, n);
    close(w.center, c);
    close(w.halfWidth, h);
    close(w.low, Math.max(0, c - h));
    close(w.high, Math.min(1, c + h));
    close(w.p, k / n);
  }
  // pinned reference values
  const a = wilson(5, 24);
  close(a.low, 0.122548, 1e-6);
  close(a.high, 0.331483, 1e-6);
  const b = wilson(0, 20);
  assert.equal(b.low, 0);
  close(b.high, 0.075892, 1e-6);
  assert.equal(wilson(30, 30).high, 1);
  assert.equal(wilson(0, 0), null);
  assert.throws(() => wilson(5, 4), RangeError);
});

test('20-29: "k of n (p%)" plus a likely range; 30+: the percentage leads', () => {
  const r = describeRate(5, 24);
  assert.equal(r.display, 'range');
  assert.equal(r.text, '5 of 24 (21%)');
  assert.equal(r.rangeText, 'likely between 12% and 33%');
  close(r.low, wilson(5, 24).low);
  const q = describeRate(7, 33);
  assert.equal(q.display, 'percent');
  assert.equal(q.text, '21% (7 of 33)');
  assert.equal(q.countText, '7 of 33');
  assert.equal(q.rangeText, 'likely between 14% and 32%');
  assert.equal(formatPercent(0.2083), '21%');
});

test('group comparison needs n >= 10 in every group', () => {
  const c = compareGroups([{ key: 'a', label: 'A', k: 9, n: 9 }, { key: 'b', label: 'B', k: 0, n: 50 }]);
  assert.equal(c.allowed, false);
  assert.equal(c.reason, 'too_few');
  assert.deepEqual(c.statements, []);
  assert.equal(c.line, 'Too few to compare yet.');
  for (const g of c.groups) assert.ok(!('p' in g.rate) || g.n >= 20);
});

test('group comparison needs non-overlapping intervals', () => {
  const overlap = compareGroups([{ key: 'a', label: 'A', k: 4, n: 10 }, { key: 'b', label: 'B', k: 3, n: 10 }]);
  assert.equal(overlap.allowed, true);
  assert.equal(overlap.reason, 'no_difference');
  assert.deepEqual(overlap.statements, []);
  assert.equal(overlap.line, 'No clear difference yet.');

  // 9/10 vs 1/10 at n = 10: intervals [0.718, 0.970] and [0.030, 0.282] do not overlap
  const apart = compareGroups([{ key: 'b', label: 'Referrals', k: 1, n: 10 }, { key: 'a', label: 'No visa needed', k: 9, n: 10 }]);
  assert.equal(apart.allowed, true);
  assert.equal(apart.reason, null);
  assert.equal(apart.statements.length, 1);
  assert.deepEqual(apart.statements[0], { higher: 'a', lower: 'b', text: 'No visa needed gets replies more often than Referrals.' });
  assert.equal(apart.line, 'No visa needed gets replies more often than Referrals.');
  assert.equal(intervalsOverlap(wilson(9, 10), wilson(1, 10)), false);
  assert.equal(intervalsOverlap(wilson(4, 10), wilson(3, 10)), true);
});

test('group comparison: pairwise statements only for non-overlapping pairs; empty groups dropped', () => {
  const c = compareGroups([
    { key: 'hi', k: 30, n: 40 }, { key: 'mid', k: 26, n: 40 }, { key: 'lo', k: 4, n: 40 }, { key: 'none', k: 0, n: 0 },
  ]);
  assert.equal(c.groups.length, 3);
  assert.equal(c.allowed, true);
  const pairs = c.statements.map((s) => `${s.higher}>${s.lower}`);
  assert.deepEqual(pairs, ['hi>lo', 'mid>lo']);
  assert.equal(compareGroups([{ key: 'only', k: 5, n: 40 }]).allowed, false);
});

test('median needs at least 5 values', () => {
  const four = median([4, 9, 12, 30]);
  assert.equal(four.allowed, false);
  assert.ok(!('value' in four));
  assert.deepEqual(four.values, [4, 9, 12, 30]);
  assert.equal(median([4]).allowed, false);
  const five = median([30, 4, 12, 9, 2]);
  assert.equal(five.allowed, true);
  assert.equal(five.value, 9);
  assert.equal(median([1, 2, 3, 4, 5, 6]).value, 3.5);
  assert.equal(quantile([1, 2, 3, 4], 0.75), null);
  assert.equal(quantile([1, 2, 3, 4, 5], 0.75), 4);
});
