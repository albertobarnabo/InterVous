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
  // Letters of any script, so "müller.de" stays whole (URL turns it into its punycode host).
  const m = String(text ?? '').match(/(?:https?:\/\/)?(?:[\p{L}\p{N}-]+\.)+\p{L}{2,}(?:\/[^\s"'<>()]*)?/iu);
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

/** Second-level suffixes such as co.uk, where the name is the label before them. */
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu']);

/**
 * A company's name from its website when nothing better is known: "elastic.co" → "Elastic",
 * "https://about.gitlab.com" → "Gitlab", "bbc.co.uk" → "Bbc". null when it is not a link.
 * @param {string | null | undefined} url
 * @returns {string | null}
 */
export function nameFromSite(url) {
  const link = linkFrom(url);
  if (!link) return null;
  const labels = new URL(link).hostname.replace(/^www\./, '').split('.');
  const n = labels.length;
  const label = n >= 3 && labels[n - 1].length === 2 && SECOND_LEVEL.has(labels[n - 2]) ? labels[n - 3] : labels[n - 2];
  return label ? label[0].toUpperCase() + label.slice(1) : null;
}

/**
 * A company name out of a one-line answer ("Elastic N.V.", "The company is Elastic."), or null when the
 * answer reads like a sentence or a refusal rather than a name.
 * @param {string | null | undefined} text
 * @returns {string | null}
 */
export function nameFromAnswer(text) {
  const unquote = (/** @type {string} */ s) => s.replace(/^["'“‘]+/, '').replace(/["'”’]+$/, '').trim();
  let t = String(text ?? '').split('\n')[0].trim().replace(/\*\*|__|`/g, '');
  t = unquote(t.replace(/^(the\s+)?(company(\s+name)?|name)(\s+is|\s*:)\s*/i, ''));
  // A sentence's final full stop goes, with any quote before it; the one in "N.V." stays.
  if (/\.$/.test(t) && !/(^|[\s.])[A-Z]\.$/.test(t)) t = unquote(t.slice(0, -1));
  if (!t || t.length > 60 || t.split(/\s+/).length > 5) return null;
  // A sentence ("It is Elastic", "Elastic owns elastic.co") or a non-answer is not a name.
  if (/\b(is|are|was|owns|owned|belongs|operates|it|this|website|site|domain)\b/i.test(t)) return null;
  if (/\b(i|cannot|can't|don't|unknown|unsure|sorry|unable|none|n\/a)\b|not (sure|specified|available)|no information/i.test(t)) return null;
  return t;
}

/** Legal forms at the end of a company name, which the same company is often written without. */
const LEGAL_FORM = /[\s,]+(n\.?v\.?|b\.?v\.?|inc\.?|incorporated|ltd\.?|limited|llc|gmbh|ag|s\.a\.?|sa|s\.r\.l\.?|srl|s\.p\.a\.?|spa|plc|corp\.?|corporation|oy|ab|a\/s|pte\.? ltd\.?|pty\.? ltd\.?)$/i;

/**
 * A company's name without its legal form: "Elastic N.V." → "Elastic", "Acme, Inc." → "Acme". Two
 * names for one company compare equal this way.
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function companyCore(name) {
  const full = String(name ?? '').trim();
  let t = full;
  for (let prev = ''; prev !== t; ) {
    prev = t;
    t = t.replace(LEGAL_FORM, '').trim();
  }
  return t || full;
}

/** Job boards whose links name the employer, and where: the first path part, a subdomain, or after a word. */
const BOARD_EMPLOYER = /** @type {Array<[RegExp, 'path' | 'subdomain' | string]>} */ ([
  [/(^|\.)(lever\.co|greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters\.com)$/, 'path'],
  [/(^|\.)(recruitee\.com|teamtailor\.com|bamboohr\.com|personio\.(de|com)|breezy\.hr|pinpointhq\.com|homerun\.co|myworkdayjobs\.com)$/, 'subdomain'],
  [/(^|\.)(linkedin\.com|wellfound\.com)$/, 'company'],
  [/(^|\.)welcometothejungle\.com$/, 'companies'],
]);

/**
 * The employer a job-board link is about: "jobs.lever.co/acme/123" → { name: "Acme", careers:
 * "https://jobs.lever.co/acme" }, "linkedin.com/company/elastic" → { name: "Elastic", careers: null }.
 * null when the link is not on a job board or does not name one.
 * @param {string | null | undefined} url
 * @returns {{ name: string, careers: string | null } | null}
 */
export function employerFromJobBoard(url) {
  const link = linkFrom(url);
  if (!link || !isJobBoardUrl(link)) return null;
  const u = new URL(link);
  const host = u.hostname.replace(/^www\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  const rule = BOARD_EMPLOYER.find(([re]) => re.test(host));
  if (!rule) return null;
  const [, where] = rule;
  const at = where === 'path' || where === 'subdomain' ? -1 : parts.indexOf(where);
  const slug = where === 'path' ? parts[0] : where === 'subdomain' ? host.split('.')[0] : at >= 0 ? parts[at + 1] : undefined;
  if (!slug || /^(jobs?|careers?|embed|apply|en|www|v\d)$/i.test(slug)) return null;
  const name = decodeURIComponent(slug).replace(/[-_+]+/g, ' ').replace(/\b\p{L}/gu, (c) => c.toUpperCase()).trim();
  const careers = where === 'path' ? `https://${u.hostname}/${slug}` : where === 'subdomain' ? `https://${u.hostname}` : null;
  return { name, careers };
}

/**
 * Escape % and _ (and the escape character) for a Postgres ILIKE pattern.
 * @param {string} s
 * @returns {string}
 */
export function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => `\\${c}`);
}
