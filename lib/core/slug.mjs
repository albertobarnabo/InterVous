// Slugs, refs and URL normalisation.
// A slug matches the jobs_slug_check constraint: ^[a-z0-9][a-z0-9-]{1,80}$ (2 to 81 characters).
// A ref (route param, CLI argument) is a slug, a unique slug prefix, or a numeric id.

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;
export const SLUG_MAX = 81;

/**
 * @param {unknown} s
 * @returns {s is string}
 */
export function isValidSlug(s) {
  return typeof s === 'string' && SLUG_RE.test(s);
}

/**
 * Lowercase ASCII slug from free text: accents dropped, anything else becomes '-',
 * repeated dashes collapsed, cut to 81 characters at a dash where possible.
 * Returns '' when nothing usable is left; check with isValidSlug before writing.
 * @param {...(string | null | undefined)} parts e.g. company, role, city
 * @returns {string}
 */
export function slugify(...parts) {
  const raw = parts.filter((p) => p != null && String(p).trim() !== '').join(' ');
  let s = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > SLUG_MAX) {
    const cut = s.slice(0, SLUG_MAX);
    const lastDash = cut.lastIndexOf('-');
    s = (lastDash >= 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
  }
  return s;
}

/**
 * The ref used in URLs: the slug, or the numeric id for legacy rows without one.
 * @param {{ id: number | string, slug?: string | null }} app
 * @returns {string}
 */
export function appRef(app) {
  return app.slug ? app.slug : String(app.id);
}

/**
 * App-relative path of the dossier ('/applications/<ref>'). The basePath (/intervous) is added by Next.
 * @param {{ id: number | string, slug?: string | null }} app
 * @returns {string}
 */
export function appPath(app) {
  return `/applications/${encodeURIComponent(appRef(app))}`;
}

/**
 * Resolve a ref against a list of rows: exact slug, then numeric id, then a unique slug prefix.
 * @template {{ id: number | string, slug?: string | null }} T
 * @param {string | number} ref
 * @param {T[]} apps
 * @returns {{ ok: true, app: T } | { ok: false, error: 'not_found' | 'ambiguous', matches: T[] }}
 */
export function resolveRef(ref, apps) {
  const r = String(ref).trim().toLowerCase();
  if (!r) return { ok: false, error: 'not_found', matches: [] };
  const exact = apps.find((a) => a.slug === r);
  if (exact) return { ok: true, app: exact };
  if (/^\d+$/.test(r)) {
    const byId = apps.find((a) => String(a.id) === r);
    if (byId) return { ok: true, app: byId };
  }
  const prefixed = apps.filter((a) => typeof a.slug === 'string' && a.slug.startsWith(r));
  if (prefixed.length === 1) return { ok: true, app: prefixed[0] };
  if (prefixed.length > 1) return { ok: false, error: 'ambiguous', matches: prefixed };
  return { ok: false, error: 'not_found', matches: [] };
}

/**
 * URL key used to match an application by its posting URL. Mirrors the RPC exactly:
 * rtrim(split_part(url, '?', 1), '/'). Empty input gives ''.
 * @param {string | null | undefined} url
 * @returns {string}
 */
export function normalizeUrl(url) {
  if (!url) return '';
  return String(url).trim().split('?')[0].replace(/\/+$/, '');
}

/** Hosts that carry many companies' job pages (their icon is the board's, not the company's). */
const JOB_BOARDS = [
  'lever.co', 'greenhouse.io', 'ashbyhq.com', 'workable.com', 'smartrecruiters.com', 'myworkdayjobs.com', 'workday.com',
  'personio.de', 'personio.com', 'recruitee.com', 'teamtailor.com', 'bamboohr.com', 'jobvite.com', 'icims.com',
  'successfactors.com', 'successfactors.eu', 'taleo.net', 'breezy.hr', 'join.com', 'pinpointhq.com', 'homerun.co',
  'eightfold.ai', 'dover.com', 'wellfound.com', 'welcometothejungle.com', 'linkedin.com', 'indeed.com', 'glassdoor.com',
];

/**
 * True when a link is on a job board rather than the company's own site.
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function isJobBoardUrl(url) {
  if (!url) return false;
  let host;
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  return JOB_BOARDS.some((b) => host === b || host.endsWith(`.${b}`));
}

/**
 * The first public https(s) link in a piece of text, as an https URL without its query, or null.
 * For answers such as "The careers page is https://acme.com/careers." No IPs, no localhost.
 * @param {string | null | undefined} text
 * @returns {string | null}
 */
export function linkFrom(text) {
  const m = String(text ?? '').match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s"'<>()]*)?/i);
  if (!m) return null;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(m[0]) ? m[0] : `https://${m[0]}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || /\.(local|internal|localhost)$/.test(host)) return null;
  const path = url.pathname.replace(/[.,;:!?]+$/, '').replace(/\/+$/, '');
  return `https://${host}${path}`;
}

/**
 * Escape % and _ (and the escape character) for a Postgres ILIKE pattern.
 * @param {string} s
 * @returns {string}
 */
export function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => `\\${c}`);
}
