// intervous proof list
// intervous proof set <key> [--name N] [--metric M] [--status verified|needs_care|unverified]
//                           [--caveat C] [--summary S] [--link URL] [--fact k=v ...]
// Proof points are his reusable projects with their canonical true numbers (facts), which the
// Insights number check (I7) compares every application's wording against.
// --fact k=v sets a fact (numbers stay numbers), k:=json sets any JSON value, k= removes it.
import { METRIC_STATUSES, METRIC_STATUS_LABELS } from '../../lib/core/index.mjs';
import { fetchAll } from '../lib/jobs.mjs';
import { emitRead, emitWrite, must, printTable, usage } from '../lib/output.mjs';
import { PROOF_KEY_RE, checkOneOf, parseFacts } from '../lib/validate.mjs';

export const options = {
  name: { type: 'string' },
  metric: { type: 'string' },
  status: { type: 'string' },
  caveat: { type: 'string' },
  summary: { type: 'string' },
  link: { type: 'string' },
  fact: { type: 'string', multiple: true },
};

export async function run(ctx, pos, flags) {
  const [sub, key, ...rest] = pos;
  if (sub === 'list' && !key) return list(ctx);
  if (sub === 'set' && key && !rest.length) return set(ctx, key, flags);
  throw usage('proof list | proof set <key> [--name N] [--metric M] [--status S] [--caveat C] [--fact k=v ...]');
}

async function list(ctx) {
  await ctx.session();
  const sb = ctx.sb;
  const [points, uses] = await Promise.all([
    fetchAll((a, b) => sb.from('proof_points').select('*').order('key').range(a, b), 'load proof points'),
    fetchAll((a, b) => sb.from('job_proof_points').select('proof_point_id, job_id').range(a, b), 'load proof point uses'),
  ]);
  const count = new Map();
  for (const u of uses) count.set(u.proof_point_id, (count.get(u.proof_point_id) ?? 0) + 1);
  const data = points.map((p) => ({ ...p, uses: count.get(p.id) ?? 0 }));
  emitRead(ctx, data, (rows) => {
    if (!rows.length) return console.log('No proof points yet. They are created by `intervous add` (proof_points[]) or `intervous proof set`.');
    printTable(rows.map((p) => ({ key: p.key, name: p.name, uses: p.uses, status: METRIC_STATUS_LABELS[p.metric_status] ?? p.metric_status, metric: p.metric ?? '', facts: Object.keys(p.facts ?? {}).length })));
  });
}

async function set(ctx, key, flags) {
  if (!PROOF_KEY_RE.test(key)) throw usage(`The key must match ^[a-z0-9][a-z0-9-]{1,60}$; got "${key}"`);
  if (flags.status) checkOneOf(flags.status, METRIC_STATUSES, '--status');
  const { set: facts, unset } = parseFacts(flags.fact ?? []);
  const sb = ctx.sb;
  await ctx.session();
  const current = must(await sb.from('proof_points').select('*').eq('key', key).maybeSingle(), 'load the proof point');
  /** @type {Record<string, any>} */
  const patch = {};
  if (flags.name !== undefined) patch.name = flags.name;
  if (flags.metric !== undefined) patch.metric = flags.metric || null;
  if (flags.status !== undefined) patch.metric_status = flags.status;
  if (flags.caveat !== undefined) patch.caveat = flags.caveat || null;
  if (flags.summary !== undefined) patch.summary = flags.summary || null;
  if (flags.link !== undefined) patch.link = flags.link || null;
  if (Object.keys(facts).length || unset.length) {
    const merged = { ...(current?.facts ?? {}), ...facts };
    for (const k of unset) delete merged[k];
    patch.facts = merged;
  }
  let row;
  if (current) {
    if (!Object.keys(patch).length) throw usage(`Nothing to change for ${key}`, 'Pass --name, --metric, --status, --caveat, --summary, --link or --fact.');
    row = must(await sb.from('proof_points').update(patch).eq('id', current.id).select('*').single(), 'update the proof point');
  } else {
    row = must(await sb.from('proof_points').insert({ key, name: patch.name ?? key, ...patch }).select('*').single(), 'create the proof point');
  }
  const data = { ...row, status: current ? 'updated' : 'created', warnings: [] };
  emitWrite(ctx, data, (d) => {
    console.log(`${d.status === 'created' ? 'Created' : 'Updated'} ${d.key} (${d.name}), ${METRIC_STATUS_LABELS[d.metric_status] ?? d.metric_status}`);
    for (const [k, v] of Object.entries(d.facts ?? {})) console.log(`  ${k} = ${JSON.stringify(v)}`);
    if (d.caveat) console.log(`  caveat: ${d.caveat}`);
  });
}
