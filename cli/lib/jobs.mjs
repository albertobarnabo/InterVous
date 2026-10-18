// Reading applications: <ref> resolution, settings, and the lib/core input for today/insights.
import { DEFAULT_SETTINGS, resolveRef, resolveSettings, todayIn } from '../../lib/core/index.mjs';
import { appLink } from './config.mjs';
import { conflict, must, notFound } from './output.mjs';

const REF_COLUMNS = 'id, slug, company_name, role, phase, applied_on, url, uncertain';

/** Page through a PostgREST select (1000 rows per request). */
export async function fetchAll(build, what) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await build(from, from + 999), what) ?? [];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

/**
 * Resolve <ref> (a slug, a unique slug prefix, or a numeric id) to a jobs row, or exit 3 / 4.
 * @param {any} ctx
 * @param {string} ref
 * @param {string} [columns] extra jobs columns to return
 */
export async function resolveJob(ctx, ref, columns = '*') {
  if (ref === undefined || ref === null || String(ref).trim() === '') throw notFound('No application given', 'Pass a slug, a unique slug prefix, or a numeric id.');
  const uid = await ctx.uid();
  const rows = await fetchAll((a, b) => ctx.sb.from('jobs').select(REF_COLUMNS).eq('user_id', uid).order('id').range(a, b), 'list applications');
  const r = resolveRef(String(ref), rows);
  if (!r.ok && r.error === 'ambiguous') {
    throw conflict(`"${ref}" matches ${r.matches.length} applications: ${r.matches.map((m) => m.slug).join(', ')}`, 'Use a longer prefix, the full slug, or the id.', {
      matches: r.matches.map((m) => ({ id: m.id, slug: m.slug, company: m.company_name, role: m.role })),
    });
  }
  if (!r.ok) throw notFound(`No application matches "${ref}"`, 'Run `intervous list` to see slugs, or `intervous find --company …`.');
  if (columns === REF_COLUMNS) return r.app;
  return must(await ctx.sb.from('jobs').select(columns).eq('id', r.app.id).single(), 'load the application');
}

/** The user_settings row, or the defaults. */
export async function loadSettings(ctx) {
  const { data, error } = await ctx.sb.from('user_settings').select('*').maybeSingle();
  if (error) must({ error }, 'load settings');
  return resolveSettings(data ?? DEFAULT_SETTINGS);
}

/** Today's date in the user's time zone. */
export async function todayFor(ctx) {
  ctx._settings ??= await loadSettings(ctx);
  return todayIn(ctx._settings.timezone);
}

/** Salary and other jobs columns that job_overview leaves out but Insights needs (I10). */
const EXTRA_JOB_COLUMNS = 'id, work_mode, channel_detail, salary_text, salary_min, salary_max, salary_currency, salary_period, posting_checked_at';

/**
 * The lib/core input {apps, events, requirements, jobProofPoints, proofPoints, contacts, settings, today}
 * with the same queries as the web's useInsightsInput(), plus contacts (Today's follow-up rule).
 */
export async function loadCoreInput(ctx) {
  const sb = ctx.sb;
  await ctx.session();
  const [apps, extra, events, requirements, jobProofPoints, proofPoints, contacts, settings] = await Promise.all([
    fetchAll((a, b) => sb.from('job_overview').select('*').order('id').range(a, b), 'load applications'),
    fetchAll((a, b) => sb.from('jobs').select(EXTRA_JOB_COLUMNS).order('id').range(a, b), 'load applications'),
    fetchAll((a, b) => sb.from('job_events').select('*').order('occurred_on').order('id').range(a, b), 'load events'),
    fetchAll((a, b) => sb.from('job_requirements').select('*').order('job_id').order('position').range(a, b), 'load fit items'),
    fetchAll((a, b) => sb.from('job_proof_points').select('*').order('job_id').order('position').range(a, b), 'load proof points'),
    fetchAll((a, b) => sb.from('proof_points').select('*').order('key').range(a, b), 'load proof points'),
    fetchAll((a, b) => sb.from('contacts').select('*').order('created_at').range(a, b), 'load contacts'),
    loadSettings(ctx),
  ]);
  const extraById = new Map(extra.map((r) => [r.id, r]));
  const merged = apps.map((a) => ({ ...(extraById.get(a.id) ?? {}), ...a }));
  return { apps: merged, events, requirements, jobProofPoints, proofPoints, contacts, settings, today: todayIn(settings.timezone) };
}

/** Short label: 'Databricks · AI Forward Deployed Engineer' */
export const jobLabel = (j) => `${j.company_name ?? j.company ?? '?'} · ${j.role ?? '?'}`;

/** Link to the dossier. */
export const jobUrl = (ctx, j) => appLink(ctx.cfg.appUrl, j);

/** The ref to print in suggested commands: slug, else the id. */
export const refOf = (j) => j.slug ?? String(j.id);
