// The sample-size rule (section 5.2). This is the only place it lives: every rate, range,
// comparison and median shown by the UI or the CLI goes through these functions.
//
//   n < 20     "k of n" and a dot strip. No percentage.
//   20 to 29   "k of n (p%)" plus "likely between a% and b%" (80% Wilson interval, z = 1.2816).
//   30 or more The percentage leads, still with "k of n" and the range.
//   Groups     A comparison sentence only when every group has n >= 10 AND the intervals do not overlap.
//   Median     Needs at least 5 values; below that, list the values.

/** z for a two-sided 80% interval. */
export const Z80 = 1.2816;
export const MIN_N_RANGE = 20;
export const MIN_N_PERCENT = 30;
export const MIN_N_GROUP = 10;
export const MIN_N_MEDIAN = 5;

/** @typedef {'counts' | 'range' | 'percent'} Display */

/**
 * What a denominator of n allows.
 * @param {number} n
 * @returns {Display}
 */
export function displayFor(n) {
  if (!(n >= MIN_N_RANGE)) return 'counts';
  if (n < MIN_N_PERCENT) return 'range';
  return 'percent';
}

/**
 * Wilson score interval for k successes in n trials.
 * centre c = (k + z²/2)/(n + z²); half-width h = z·√(k(n−k)/n + z²/4)/(n + z²).
 * Bounds are clamped to [0, 1]. null when n is 0.
 * @param {number} k
 * @param {number} n
 * @param {number} [z]
 * @returns {{ k: number, n: number, p: number, center: number, halfWidth: number, low: number, high: number } | null}
 */
export function wilson(k, n, z = Z80) {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (!Number.isFinite(k) || k < 0 || k > n) throw new RangeError(`wilson: need 0 <= k <= n, got k=${k} n=${n}`);
  const z2 = z * z;
  const center = (k + z2 / 2) / (n + z2);
  const halfWidth = (z * Math.sqrt((k * (n - k)) / n + z2 / 4)) / (n + z2);
  return {
    k, n, p: k / n, center, halfWidth,
    low: Math.max(0, center - halfWidth),
    high: Math.min(1, center + halfWidth),
  };
}

/**
 * Whole-number percentage text: 0.2083 -> '21%'.
 * @param {number} p
 * @returns {string}
 */
export function formatPercent(p) {
  return `${Math.round(p * 100)}%`;
}

/**
 * @typedef {object} Rate
 * @property {number} k
 * @property {number} n
 * @property {Display} display
 * @property {string} text          Always present: '1 of 6'. For n >= 30: '21%' leads ('21% (7 of 33)').
 * @property {string} countText     '1 of 6'
 * @property {number} [p]           Only when n >= 20.
 * @property {number} [low]         Only when n >= 20 (80% Wilson).
 * @property {number} [high]        Only when n >= 20.
 * @property {string} [percentText] Only when n >= 20: '21%'.
 * @property {string} [rangeText]   Only when n >= 20: 'likely between 12% and 32%'.
 */

/**
 * A rate packaged with what the sample-size rule lets you show. Below n = 20 the result
 * carries no p, no interval and no percentage text at all, so a caller cannot show one by accident.
 * @param {number} k
 * @param {number} n
 * @returns {Rate}
 */
export function describeRate(k, n) {
  const display = displayFor(n);
  const countText = `${k} of ${n}`;
  if (display === 'counts') return { k, n, display, text: countText, countText };
  const w = /** @type {NonNullable<ReturnType<typeof wilson>>} */ (wilson(k, n));
  const percentText = formatPercent(w.p);
  const rangeText = `likely between ${formatPercent(w.low)} and ${formatPercent(w.high)}`;
  const text = display === 'range' ? `${countText} (${percentText})` : `${percentText} (${countText})`;
  return { k, n, display, text, countText, p: w.p, low: w.low, high: w.high, percentText, rangeText };
}

/**
 * @param {{ low: number, high: number }} a
 * @param {{ low: number, high: number }} b
 * @returns {boolean}
 */
export function intervalsOverlap(a, b) {
  return a.low <= b.high && b.low <= a.high;
}

/**
 * @typedef {object} GroupInput
 * @property {string} key
 * @property {string} [label]
 * @property {number} k
 * @property {number} n
 */

/**
 * @typedef {object} GroupComparison
 * @property {boolean} allowed      Every group has n >= 10 (and there are at least 2 groups).
 * @property {'too_few' | 'no_difference' | null} reason
 * @property {Array<GroupInput & { label: string, rate: Rate, interval: ReturnType<typeof wilson> }>} groups  `interval` is null below n = 20 (nothing to draw)
 * @property {Array<{ higher: string, lower: string, text: string }>} statements  Only pairs whose intervals do not overlap, and only when allowed.
 * @property {string} line          The one line to show: the first statement, 'Too few to compare yet.' or 'No clear difference yet.'
 */

/**
 * Compare response rates between groups. Groups with n = 0 are dropped first.
 * A statement "A <verb> B" is produced only when every group has n >= 10 and A's and B's
 * 80% intervals do not overlap; otherwise the caller shows a dot strip per group and `line`.
 * @param {GroupInput[]} groups
 * @param {{ minN?: number, verb?: string }} [opts]
 * @returns {GroupComparison}
 */
export function compareGroups(groups, opts = {}) {
  const minN = opts.minN ?? MIN_N_GROUP;
  const verb = opts.verb ?? 'gets replies more often than';
  const gs = groups
    .filter((g) => g.n > 0)
    .map((g) => ({ ...g, label: g.label ?? g.key, rate: describeRate(g.k, g.n), w: wilson(g.k, g.n) }));
  const allowed = gs.length >= 2 && gs.every((g) => g.n >= minN);
  /** @type {Array<{ higher: string, lower: string, text: string }>} */
  const statements = [];
  if (allowed) {
    const sorted = [...gs].sort((a, b) => (b.k / b.n) - (a.k / a.n));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const hi = sorted[i], lo = sorted[j];
        if (hi.w && lo.w && !intervalsOverlap(hi.w, lo.w)) {
          statements.push({ higher: hi.key, lower: lo.key, text: `${hi.label} ${verb} ${lo.label}.` });
        }
      }
    }
  }
  const reason = !allowed ? 'too_few' : statements.length === 0 ? 'no_difference' : null;
  const line = !allowed ? 'Too few to compare yet.' : statements.length === 0 ? 'No clear difference yet.' : statements[0].text;
  // the interval is only handed out where a range may be shown (n >= 20)
  const out = gs.map(({ w, ...g }) => ({ ...g, interval: g.n >= MIN_N_RANGE ? w : null }));
  return { allowed, reason, groups: out, statements, line };
}

/**
 * Median, allowed only with at least 5 values. Below that `value` is absent and the caller lists `values`.
 * @param {number[]} values
 * @returns {{ count: number, allowed: boolean, values: number[], value?: number }}
 */
export function median(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length < MIN_N_MEDIAN) return { count: v.length, allowed: false, values: v };
  const mid = Math.floor(v.length / 2);
  const value = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return { count: v.length, allowed: true, values: v, value };
}

/**
 * Quantile with linear interpolation (q in [0, 1]); null below 5 values, like the median.
 * @param {number[]} values
 * @param {number} q
 * @returns {number | null}
 */
export function quantile(values, q) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length < MIN_N_MEDIAN) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}
