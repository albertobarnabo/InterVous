// intervous find --url U | --company C [--role R]
// Duplicate check before building a CV. URLs are compared the way the RPC matches them
// (query string and trailing slash dropped); names with ILIKE, % and _ escaped.
import { escapeLike, normalizeUrl, phaseLabel } from '../../lib/core/index.mjs';
import { jobUrl } from '../lib/jobs.mjs';
import { emitRead, must, printTable, usage } from '../lib/output.mjs';

export const options = {
  url: { type: 'string' },
  company: { type: 'string' },
  role: { type: 'string' },
};

const COLS = 'id, slug, company_name, role, phase, applied_on, cv_built_on, url';

export async function run(ctx, _pos, flags) {
  if (!flags.url && !flags.company) throw usage('find needs --url U or --company C', 'intervous find --url https://… | --company Databricks [--role "AI Engineer"]');
  const uid = await ctx.uid();
  const sb = ctx.sb;
  /** @type {any[]} */
  let rows = [];
  let matchedBy = null;
  if (flags.url) {
    const norm = normalizeUrl(flags.url);
    if (!norm) throw usage('--url is empty');
    const hits = must(await sb.from('jobs').select(COLS).eq('user_id', uid).ilike('url', `${escapeLike(norm)}%`).order('id'), 'search by URL');
    rows = hits.filter((r) => normalizeUrl(r.url) === norm);
    matchedBy = 'url';
  }
  if (!rows.length && flags.company) {
    let q = sb.from('jobs').select(COLS).eq('user_id', uid).ilike('company_name', `%${escapeLike(flags.company.trim())}%`);
    if (flags.role) q = q.ilike('role', `%${escapeLike(flags.role.trim())}%`);
    rows = must(await q.order('id').limit(1000), 'search by company');
    matchedBy = flags.role ? 'company_role' : 'company';
  }
  const data = rows.map((r) => ({
    id: r.id, slug: r.slug, company: r.company_name, role: r.role, phase: r.phase, applied_on: r.applied_on,
    cv_built_on: r.cv_built_on, url: r.url || null, matched_by: matchedBy, app_url: jobUrl(ctx, r),
  }));
  emitRead(ctx, data, (d) => {
    if (!d.length) return console.log('No application matches. Safe to create a new one.');
    console.log(`${d.length} ${d.length === 1 ? 'application matches' : 'applications match'} (by ${matchedBy?.replace('_', ' + ')}):\n`);
    printTable(d.map((r) => ({ id: r.id, slug: r.slug ?? '', company: r.company, role: r.role, phase: phaseLabel(r.phase), sent: r.applied_on ?? '' })), { count: false });
    console.log('\nUpdate that application instead of creating a new one.');
  });
}
