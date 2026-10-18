// intervous doctor [--orphans]
// Read-only health check: config, session, migration (job_overview + the RPC probed with a bad slug,
// which must answer 22023), and the bucket (list <uid>/). --orphans lists stored files that no
// application refers to (left behind when an `add` failed after uploading).
import fs from 'node:fs';
import { BUCKET, configDir, lockFile, sessionFile } from '../lib/config.mjs';
import { formatBytes, listObjects } from '../lib/files.mjs';
import { CliError, EXIT, SCHEMA_HINT, LOGIN_HINT, emitRead, fromSupabase } from '../lib/output.mjs';

export const options = {
  orphans: { type: 'boolean' },
};

const TABLES = ['job_events', 'job_documents', 'job_answers', 'job_requirements', 'proof_points', 'job_proof_points', 'contacts', 'user_settings'];

const mode = (p) => {
  try {
    return fs.statSync(p).mode & 0o777;
  } catch {
    return null;
  }
};

export async function run(ctx, _pos, flags) {
  /** @type {Array<{ id: string, level: 'ok' | 'warn' | 'fail', detail: string, hint?: string | null, exit?: number }>} */
  const checks = [];
  const add = (id, level, detail, hint = null, exit = undefined) => checks.push({ id, level, detail, hint, exit });
  const out = { ok: false, checks, orphans: undefined };

  // 1. config
  let cfg;
  try {
    cfg = ctx.cfg;
    add('config', 'ok', `${new URL(cfg.url).host} (from ${cfg.source}); app ${cfg.appUrl}`);
  } catch (e) {
    add('config', 'fail', /** @type {Error} */ (e).message, 'Set INTERVOUS_URL and INTERVOUS_ANON_KEY, or restore the app .env.', EXIT.USAGE);
    return finish(ctx, out);
  }

  // 2. session
  let session = null;
  const dirMode = mode(configDir());
  const fileMode = mode(sessionFile());
  const perms = [];
  if (dirMode !== null && dirMode !== 0o700) perms.push(`${configDir()} is ${dirMode.toString(8)}, should be 700`);
  if (fileMode !== null && fileMode !== 0o600) perms.push(`session.json is ${fileMode.toString(8)}, should be 600`);
  try {
    session = await ctx.session();
    const exp = session.expires_at ? new Date(session.expires_at * 1000).toISOString().slice(0, 16).replace('T', ' ') : '?';
    add('session', perms.length ? 'warn' : 'ok', `${session.user.email}, token valid until ${exp} UTC${perms.length ? `; ${perms.join('; ')}` : ''}`,
      perms.length ? `chmod 700 ${configDir()} && chmod 600 ${sessionFile()}` : null);
  } catch (e) {
    const err = e instanceof CliError ? e : fromSupabase(e);
    add('session', 'fail', err.message, err.hint ?? LOGIN_HINT, err.exit);
  }
  try {
    const st = fs.statSync(lockFile());
    const age = Math.round((Date.now() - st.mtimeMs) / 1000);
    if (age > 30) add('lock', 'warn', `a stale session.lock (${age}s old) is in ${configDir()}`, 'The next command removes it; nothing to do unless it keeps coming back.');
  } catch {
    /* no lock: normal */
  }
  if (!session) return finish(ctx, out);
  const sb = ctx.sb;
  const uid = session.user.id;

  // 3. migration
  /** @type {Array<{ label: string, message: string }>} */
  const problems = [];
  let apps = null;
  let network = null;
  const probe = async (label, q) => {
    const { error, count } = await q;
    if (!error) return count ?? 0;
    const err = fromSupabase(error);
    if (err.code === 'network') network = err;
    problems.push({ label, message: `${error.code ? `${error.code} ` : ''}${error.message}` });
    return null;
  };
  // GET with limit 0, not HEAD: supabase-js reports a HEAD 404 (missing table) as success
  const empty = (table, cols) => sb.from(table).select(cols, { count: 'exact' }).limit(0);
  apps = await probe('job_overview', empty('job_overview', 'id'));
  for (const t of TABLES) await probe(t, empty(t, '*'));
  await probe('jobs.phase', empty('jobs', 'id, phase, slug'));
  const unphased = problems.some((x) => x.label === 'jobs.phase') ? null : await probe('jobs without phase', empty('jobs', 'id').is('phase', null));
  const rpc = await sb.rpc('iv_upsert_application', { p: { slug: 'X' } });
  let rpcState;
  if (rpc.error?.code === '22023') rpcState = 'iv_upsert_application answers (bad slug refused with 22023)';
  else if (rpc.error) {
    problems.push({ label: 'iv_upsert_application', message: `${rpc.error.code ? `${rpc.error.code} ` : ''}${rpc.error.message}` });
    if (fromSupabase(rpc.error).code === 'network') network = fromSupabase(rpc.error);
  } else problems.push({ label: 'iv_upsert_application', message: 'accepted a bad slug; this is not the v2 function' });
  if (network) {
    add('migration', 'fail', network.message, network.hint, EXIT.SERVER);
    return finish(ctx, out);
  }
  if (problems.length) {
    const first = problems[0];
    const detail = problems.length === 1
      ? `${first.label}: ${first.message}`
      : `${problems.length} parts of the v2 schema are missing: ${problems.map((x) => x.label).join(', ')} (first: ${first.message})`;
    add('migration', 'fail', detail, SCHEMA_HINT, EXIT.SCHEMA);
  }
  else {
    add('migration', unphased ? 'warn' : 'ok', `job_overview (${apps} ${apps === 1 ? 'application' : 'applications'}), ${TABLES.length} tables, ${rpcState}${unphased ? `; ${unphased} jobs have no phase` : ''}`,
      unphased ? 'Re-run the migration: its backfill sets the phase of older rows.' : null);
  }

  // 4. storage
  try {
    const { data, error } = await sb.storage.from(BUCKET).list(`${uid}/`, { limit: 1000 });
    if (error) throw fromSupabase(error, `list ${BUCKET}/${uid}/`);
    const folders = (data ?? []).length;
    let detail = `${BUCKET}: ${uid}/ lists ${folders} ${folders === 1 ? 'entry' : 'entries'}`;
    let level = 'ok';
    let hint = null;
    if (problems.length) {
      level = 'warn';
      detail += '; the bucket itself comes with the migration, so it is not checked yet';
    } else {
      const { data: doc } = await sb.from('job_documents').select('storage_path').not('storage_path', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (doc?.storage_path) {
        const signed = await sb.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
        if (signed.error) {
          level = 'fail';
          detail += `; the newest stored file does not open (${signed.error.message})`;
          hint = 'Check that the bucket and its 4 "intervous-docs own …" policies exist (migration section 9).';
        } else detail += '; the newest stored file opens';
      } else detail += '; no stored files yet, so reading one was not tested';
    }
    add('storage', level, detail, hint, level === 'fail' ? EXIT.SERVER : undefined);
  } catch (e) {
    const err = e instanceof CliError ? e : fromSupabase(e);
    add('storage', 'fail', err.message, 'Check that the bucket intervous-docs exists (migration section 9).', err.exit);
  }

  // 5. orphans
  if (flags.orphans && !problems.length) {
    const objects = await listObjects(sb, uid);
    const { data: docs, error } = await sb.from('job_documents').select('storage_path').not('storage_path', 'is', null);
    if (error) throw fromSupabase(error, 'load documents');
    const used = new Set((docs ?? []).map((d) => d.storage_path));
    out.orphans = objects.filter((o) => !used.has(o.name));
    add('orphans', out.orphans.length ? 'warn' : 'ok', out.orphans.length
      ? `${out.orphans.length} stored ${out.orphans.length === 1 ? 'file is' : 'files are'} not attached to any application`
      : `all ${objects.length} stored files are attached to an application`,
    out.orphans.length ? 'They are harmless. Remove one with `intervous storage remove intervous-docs <path> --yes`.' : null);
  }
  return finish(ctx, out);
}

function finish(ctx, out) {
  const failed = out.checks.filter((c) => c.level === 'fail');
  out.ok = failed.length === 0;
  if (failed.length) process.exitCode = failed[0].exit ?? EXIT.SERVER;
  const data = { ok: out.ok, checks: out.checks.map((c) => ({ id: c.id, level: c.level, detail: c.detail, hint: c.hint })) };
  if (out.orphans) data.orphans = out.orphans;
  emitRead(ctx, data, () => {
    const mark = { ok: '✓', warn: '!', fail: '✗' };
    const w = Math.max(...out.checks.map((c) => c.id.length));
    console.log('InterVous doctor');
    for (const c of out.checks) {
      console.log(`  ${mark[c.level]} ${c.id.padEnd(w)}  ${c.detail}`);
      if (c.hint && c.level !== 'ok') console.log(`    ${' '.repeat(w)}  ${c.hint}`);
    }
    for (const o of out.orphans ?? []) console.log(`      ${o.name}  ${formatBytes(o.size)}`);
    console.log(out.ok ? (out.checks.some((c) => c.level === 'warn') ? 'Green, with warnings.' : 'All green.') : 'Not green yet.');
  });
}
