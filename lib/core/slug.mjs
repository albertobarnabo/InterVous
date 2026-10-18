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

/**
 * Escape % and _ (and the escape character) for a Postgres ILIKE pattern.
 * @param {string} s
 * @returns {string}
 */
export function escapeLike(s) {
  return String(s).replace(/[\\%_]/g, (c) => `\\${c}`);
}
