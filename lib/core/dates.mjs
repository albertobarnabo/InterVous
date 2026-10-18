// Date helpers. Every calendar date in InterVous is a plain 'YYYY-MM-DD' string
// (Postgres `date` columns come back that way). Arithmetic is done on whole days since
// 1970-01-01, so no time zone or DST shift can move a date by one.
// Timestamps (timestamptz) are converted to a calendar date in an explicit time zone.

const DAY_MS = 86400000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_PREFIX_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_TIMEZONE = 'Europe/Berlin';

/**
 * True for a valid calendar date written exactly as 'YYYY-MM-DD'.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isDateString(value) {
  if (typeof value !== 'string') return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/**
 * Calendar date of an instant in a time zone, as 'YYYY-MM-DD'.
 * @param {Date} instant
 * @param {string} [timeZone]
 * @returns {string}
 */
function dateInZone(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const get = (/** @type {string} */ t) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Normalise a date-ish value to 'YYYY-MM-DD'.
 * - 'YYYY-MM-DD' is returned as is (it is already a local calendar date).
 * - A timestamp string or a Date is converted to the calendar date in `timeZone`
 *   (UTC when no zone is given, which matches Postgres `timestamptz::date` on Supabase).
 * - null, undefined, '' and unparseable values give null.
 * @param {string | Date | null | undefined} value
 * @param {string} [timeZone]
 * @returns {string | null}
 */
export function toDateOnly(value, timeZone) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : dateInZone(value, timeZone);
  if (typeof value !== 'string') return null;
  if (DATE_RE.test(value) && isDateString(value)) return value;
  if (DATE_RE.test(value)) return null;
  if (DATE_PREFIX_RE.test(value) && value.length > 10) {
    const t = new Date(value);
    if (!Number.isNaN(t.getTime())) return dateInZone(t, timeZone);
    const prefix = value.slice(0, 10);
    return isDateString(prefix) ? prefix : null;
  }
  return null;
}

/**
 * Today's calendar date in a time zone (settings.timezone, Europe/Berlin by default).
 * @param {string} [timeZone]
 * @param {Date} [now]
 * @returns {string}
 */
export function todayIn(timeZone = DEFAULT_TIMEZONE, now = new Date()) {
  return dateInZone(now, timeZone);
}

/**
 * Whole days since 1970-01-01 for a 'YYYY-MM-DD' date (or timestamp, converted in `timeZone`).
 * @param {string | Date | null | undefined} value
 * @param {string} [timeZone]
 * @returns {number | null}
 */
export function toDayNumber(value, timeZone) {
  const d = toDateOnly(value, timeZone);
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, day) / DAY_MS);
}

/**
 * 'YYYY-MM-DD' for a day number.
 * @param {number} n
 * @returns {string}
 */
export function fromDayNumber(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Whole days from `from` to `to` (positive when `to` is later). null when either is missing.
 * @param {string | Date | null | undefined} from
 * @param {string | Date | null | undefined} to
 * @param {string} [timeZone]
 * @returns {number | null}
 */
export function daysBetween(from, to, timeZone) {
  const a = toDayNumber(from, timeZone);
  const b = toDayNumber(to, timeZone);
  return a === null || b === null ? null : b - a;
}

/**
 * @param {string} date 'YYYY-MM-DD'
 * @param {number} days
 * @returns {string}
 */
export function addDays(date, days) {
  const n = toDayNumber(date);
  if (n === null) throw new TypeError(`addDays: not a date: ${date}`);
  return fromDayNumber(n + days);
}

/**
 * Day of the week, 0 = Sunday ... 6 = Saturday.
 * @param {string} date
 * @returns {number}
 */
export function weekday(date) {
  const n = toDayNumber(date);
  if (n === null) throw new TypeError(`weekday: not a date: ${date}`);
  return (((n + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}

/**
 * Monday of the ISO week that contains `date`.
 * @param {string} date
 * @returns {string}
 */
export function isoWeekStart(date) {
  const n = toDayNumber(date);
  if (n === null) throw new TypeError(`isoWeekStart: not a date: ${date}`);
  const wd = weekday(date);
  return fromDayNumber(n - ((wd + 6) % 7));
}

/**
 * ISO 8601 week number and week-year.
 * @param {string} date
 * @returns {{ year: number, week: number }}
 */
export function isoWeek(date) {
  const monday = toDayNumber(isoWeekStart(date));
  if (monday === null) throw new TypeError(`isoWeek: not a date: ${date}`);
  const thursday = fromDayNumber(monday + 3);
  const year = Number(thursday.slice(0, 4));
  const jan4 = `${year}-01-04`;
  const week1Monday = toDayNumber(isoWeekStart(jan4));
  return { year, week: Math.floor((monday - /** @type {number} */ (week1Monday)) / 7) + 1 };
}

/**
 * Short display date: '30 Aug'. The year is added when it differs from `today`'s year
 * (or always, with `withYear: true`): '19 Oct 2025'.
 * @param {string | Date | null | undefined} value
 * @param {{ today?: string, withYear?: boolean, timeZone?: string }} [opts]
 * @returns {string}
 */
export function formatShort(value, opts = {}) {
  const d = toDateOnly(value, opts.timeZone);
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  const base = `${day} ${MONTHS[m - 1]}`;
  const showYear = opts.withYear || (opts.today ? Number(opts.today.slice(0, 4)) !== y : false);
  return showYear ? `${base} ${y}` : base;
}

/**
 * Day heading: 'Sat 17 Oct'.
 * @param {string} date
 * @returns {string}
 */
export function formatDay(date) {
  return `${WEEKDAYS[weekday(date)]} ${formatShort(date)}`;
}

/**
 * '1 day' / '5 days'.
 * @param {number} n
 * @returns {string}
 */
export function pluralDays(n) {
  return `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`;
}

/**
 * Relative age of a timestamp: 'just now', '5 min ago', '2h ago', 'yesterday', '3 days ago'.
 * @param {string | Date | null | undefined} timestamp
 * @param {Date | string} [now]
 * @returns {string}
 */
export function formatAgo(timestamp, now = new Date()) {
  if (!timestamp) return '';
  const t = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const n = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(t.getTime()) || Number.isNaN(n.getTime())) return '';
  const sec = Math.max(0, Math.round((n.getTime() - t.getTime()) / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

/**
 * Latest of the given dates, ignoring empty values. null when none is set.
 * @param {...(string | null | undefined)} dates
 * @returns {string | null}
 */
export function maxDate(...dates) {
  /** @type {string | null} */
  let best = null;
  for (const d of dates) {
    const v = toDateOnly(d);
    if (v && (best === null || v > best)) best = v;
  }
  return best;
}

/**
 * Earliest of the given dates, ignoring empty values. null when none is set.
 * @param {...(string | null | undefined)} dates
 * @returns {string | null}
 */
export function minDate(...dates) {
  /** @type {string | null} */
  let best = null;
  for (const d of dates) {
    const v = toDateOnly(d);
    if (v && (best === null || v < best)) best = v;
  }
  return best;
}
