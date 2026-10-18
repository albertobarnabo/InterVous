// intervous import <history.json> --map <adopt.json> [--dry-run] [--only slug,slug] [--emit-fixture FILE]
//
// The one-time history import (spec section 7). Every history record becomes one manifest
// (cli/import/rules.mjs, with the maps next to adopt.json) and goes through the same write path as
// `intervous add`: prepareApplication() then pushApplication(), one iv_upsert_application call
// (one transaction) per application.
//
//   1. Re-derive which live row each slug lands on and refuse when adopt.json disagrees (7.2).
//   2. Build and validate all 18 manifests before anything is written.
//   3. Plan each one read-only: the field diff, the fit items and topics, proof points, new events,
//      files to upload, warnings, and whether the call would change anything at all.
//   4. --dry-run prints that table and stops. Otherwise each application that would change is
//      written; one that would not is skipped, so a re-run changes nothing (7.4 step 4).
// The legacy rows on adopt.json's leave_alone list are never written, and checked afterwards.
import path from 'node:path';
import { formatBytes, objectPath, resolvePath } from '../lib/files.mjs';
import { fetchAll, todayFor } from '../lib/jobs.mjs';
import { prepareApplication, pushApplication } from '../lib/manifest.mjs';
import { conflict, emitWrite, fmt, must, usage } from '../lib/output.mjs';
import { deriveAdoption } from '../import/adopt.mjs';
import { loadProofPoints, loadStored, pendingChanges } from '../import/compare.mjs';
import { checkFixturePath, emitFixture } from '../import/fixture.mjs';
import { buildManifest, loadHistory, loadMaps } from '../import/rules.mjs';

export const options = {
  map: { type: 'string' },
  'dry-run': { type: 'boolean' },
  only: { type: 'string' },
  'emit-fixture': { type: 'string' },
};

const USAGE = 'intervous import <history.json> --map <adopt.json> [--dry-run] [--only slug,slug] [--emit-fixture FILE]';

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function run(ctx, pos, flags) {
  if (pos.length !== 1) throw usage('import takes one history file', USAGE);
  if (!flags.map) throw usage('--map <adopt.json> is required (the other maps sit next to it)', USAGE);
  const dryRun = Boolean(flags['dry-run']);
  const fixtureFile = flags['emit-fixture'] ? checkFixturePath(flags['emit-fixture']) : null;

  const history = loadHistory(resolvePath(pos[0]));
  const maps = loadMaps(resolvePath(flags.map));
  const only = flags.only ? String(flags.only).split(',').map((s) => s.trim()).filter(Boolean) : null;
  for (const s of only ?? []) if (!history.applications.some((a) => a.id === s)) throw usage(`--only: ${s} is not in ${history.file}`);

  const sb = ctx.sb;
  const uid = await ctx.uid();
  const today = await todayFor(ctx);
  const timeZone = ctx._settings?.timezone ?? 'Europe/Berlin';

  // 1. which row each record lands on
  const rows = await fetchAll((a, b) => sb.from('jobs').select('id, slug, company_name, role, url, phase, applied_on, status, stage').eq('user_id', uid).order('id').range(a, b), 'list applications');
  const adoption = deriveAdoption(history.applications, rows, maps);
  if (adoption.errors.length) {
    throw conflict(
      `The adoption table does not match the live rows (${adoption.errors.length} problem${adoption.errors.length === 1 ? '' : 's'}):\n  - ${adoption.errors.join('\n  - ')}`,
      `Fix ${maps.adoptFile}, then run the dry run again. Nothing was written.`,
      { errors: adoption.errors, table: adoption.table },
    );
  }
  const bySlug = new Map(adoption.table.map((t) => [t.slug, t]));
  const rowById = new Map(rows.map((r) => [Number(r.id), r]));

  // 2. every manifest, validated, before anything is written
  const records = history.applications.filter((a) => !only || only.includes(a.id));
  const items = records.map((rec) => {
    const a = /** @type {import('../import/adopt.mjs').Adoption} */ (bySlug.get(rec.id));
    const live = a.id !== null ? rowById.get(a.id) ?? null : null;
    const { manifest, warnings } = buildManifest(rec, maps, { jobId: a.action === 'adopt' ? a.id : null, liveCompany: live?.company_name ?? null, timeZone });
    let prepared;
    try {
      prepared = prepareApplication(manifest, { baseDir: maps.dir, today, fillAppliedOn: false });
    } catch (e) {
      if (e instanceof Error) e.message = `${rec.id}: ${e.message}`;
      throw e;
    }
    prepared.warnings.unshift(...warnings);
    if (a.note) prepared.warnings.unshift(a.note);
    return { rec, a, live, prepared };
  });

  // 3. plan, read-only
  // (only id and name: the live companies table has no created_at column)
  const companies = await fetchAll((a, b) => sb.from('companies').select('id, name').order('name').order('id').range(a, b), 'load companies');
  const companyOf = (name) => companies.find((c) => String(c.name).trim().toLowerCase() === String(name ?? '').trim().toLowerCase()) ?? null;
  const proofPoints = await loadProofPoints(ctx);
  const leaveBefore = maps.leaveAlone.length ? must(await sb.from('jobs').select('*').in('id', maps.leaveAlone).order('id'), 'load the legacy rows') ?? [] : [];

  const plans = [];
  const creating = new Set(); // companies an earlier application in this run creates
  for (const it of items) {
    const plan = await pushApplication(ctx, it.prepared, { dryRun: true });
    const cname = String(plan.company?.name ?? '').toLowerCase();
    if (plan.company?.status === 'would_create') {
      if (creating.has(cname)) plan.company.status = 'would_link_new';
      creating.add(cname);
    }
    if ((plan.id ?? null) !== it.a.id) throw conflict(`${it.rec.id}: the write would land on ${plan.id ? `#${plan.id}` : 'a new row'}, the adoption table says ${it.a.id ? `#${it.a.id}` : 'a new row'}`, 'Nothing was written.');
    const stored = it.a.id !== null ? await loadStored(ctx, it.a.id) : null;
    const full = fullPayload(it.prepared, uid);
    const reasons = pendingChanges(stored, full, { company: companyOf(full.company), proofPoints });
    plans.push(describe(it, plan, reasons, stored));
  }

  // 4. write
  if (!dryRun) {
    for (const [i, it] of items.entries()) {
      const p = plans[i];
      if (!p.reasons.length) {
        p.result = 'unchanged';
        continue;
      }
      try {
        const res = await pushApplication(ctx, it.prepared, { dryRun: false });
        p.id = res.id;
        p.result = res.created ? 'created' : res.adopted ? 'adopted' : 'updated';
        p.company.created = res.company_created;
        p.documents = p.documents.map((d) => {
          if (d.kind === 'jd_snapshot') return { ...d, status: d.status === 'would_store' ? 'stored' : d.status };
          return { ...d, status: res.documents.find((r) => r.kind === d.kind && r.path === d.path)?.status ?? d.status };
        });
        if (!ctx.json) process.stderr.write(`  ${p.result.padEnd(9)} #${res.id} ${res.slug}\n`);
      } catch (e) {
        const done = plans.filter((x) => x.result && x.result !== 'unchanged').map((x) => x.slug);
        if (e instanceof Error) e.message = `${it.rec.id}: ${e.message} (already written in this run: ${done.length ? done.join(', ') : 'none'}; a re-run continues where this stopped)`;
        throw e;
      }
    }
  }

  const leaveAfter = maps.leaveAlone.length ? must(await sb.from('jobs').select('*').in('id', maps.leaveAlone).order('id'), 'load the legacy rows') ?? [] : [];
  const touched = leaveAfter.filter((r) => !same(r, leaveBefore.find((b) => b.id === r.id))).map((r) => r.id);
  const fixture = fixtureFile ? await emitFixture(ctx, fixtureFile) : null;

  const totals = {
    applications: plans.length,
    create: plans.filter((p) => p.action === 'create').length,
    adopt: plans.filter((p) => p.action === 'adopt').length,
    update: plans.filter((p) => p.action === 'update').length,
    would_change: plans.filter((p) => p.reasons.length).length,
    unchanged: plans.filter((p) => !p.reasons.length).length,
    uploads: plans.flatMap((p) => p.documents).filter((d) => d.status === 'would_upload' || d.status === 'uploaded').length,
    upload_bytes: plans.flatMap((p) => p.documents).filter((d) => d.status === 'would_upload' || d.status === 'uploaded').reduce((s, d) => s + (d.size ?? 0), 0),
  };
  const data = {
    mode: dryRun ? 'dry_run' : 'import',
    today,
    history: history.file,
    maps: maps.dir,
    totals,
    left_alone: { ids: maps.leaveAlone, present: leaveAfter.map((r) => r.id), touched },
    warnings: adoption.warnings,
    applications: plans,
    ...(fixture ? { fixture } : {}),
  };
  emitWrite(ctx, data, printHuman);
}

/** The payload the RPC call would receive (documents included), for the no-change check. */
function fullPayload(prepared, uid) {
  const p = structuredClone(prepared.payload);
  p.source ??= 'cli';
  const docs = [...(Array.isArray(p.documents) ? p.documents : [])];
  for (const u of prepared.uploads) {
    docs.push({ kind: u.kind, sha256: u.sha256, storage_path: objectPath(uid, p.slug, u.kind, u.sha256, u.file), label: u.label ?? null, submitted: u.submitted ?? null });
  }
  for (const d of prepared.inline) docs.push(d);
  if (docs.length) p.documents = docs;
  return p;
}

/** One row of the dry-run table (spec 7.4 step 2). */
function describe(it, plan, reasons, stored) {
  const p = it.prepared.payload;
  const job = stored?.job ?? null;
  const reqs = p.requirements ?? [];
  const count = (v) => reqs.filter((r) => r.verdict === v).length;
  const oldGap = new Map((stored?.requirements ?? []).map((r) => [String(r.requirement).toLowerCase(), r.gap_state]));
  const topics = reqs.filter((r) => r.verdict === 'gap' || r.verdict === 'partial')
    .map((r) => ({ topic: r.topic, gap_state: r.gap_state ?? oldGap.get(String(r.requirement).toLowerCase()) ?? 'open', requirement: r.requirement }));
  const phaseFrom = job?.phase ?? null;
  const fixes = it.a.action === 'adopt' && job && (phaseFrom !== p.phase || String(job.applied_on ?? '') !== String(p.applied_on ?? ''));
  const jd = (p.documents ?? []).filter((d) => d.kind === 'jd_snapshot').map((d) => {
    const known = (stored?.documents ?? []).some((s) => s.kind === d.kind && s.sha256 === d.sha256);
    return { kind: d.kind, status: known ? 'unchanged' : 'would_store', size: d.size_bytes, label: d.label };
  });
  return {
    slug: it.rec.id,
    id: plan.id,
    action: it.a.action,
    matched_by: it.a.by,
    company: { name: plan.company?.name ?? null, status: plan.company?.status ?? null },
    role: p.role,
    phase: {
      from: phaseFrom,
      to: p.phase,
      applied_on: { from: job?.applied_on ?? null, to: p.applied_on ?? null },
      note: fixes ? 'fixes earlier import' : null,
    },
    uncertain: p.uncertain ?? [],
    changes: plan.changes,
    fit: { met: count('met'), partial: count('partial'), gap: count('gap'), caution: count('caution'), topics },
    proof_points: (p.proof_points ?? []).map((x) => x.key),
    events: plan.lists.events ?? { existing: 0, new: [] },
    answers: { total: (p.answers ?? []).length, saved: (p.answers ?? []).filter((a) => a.answer).length },
    contacts: (p.contacts ?? []).length,
    documents: [...plan.documents.map((d) => ({ kind: d.kind, status: d.status, size: d.size ?? null, file: d.file ? path.basename(d.file) : null, path: d.path ?? null })), ...jd],
    reasons,
    result: null,
    warnings: plan.warnings,
  };
}

// ---------------------------------------------------------------------------
// plain text
// ---------------------------------------------------------------------------

const DOC_STATUS = {
  would_upload: 'upload', would_attach: 'attach (in storage)', would_store: 'store', unchanged: 'unchanged',
  uploaded: 'uploaded', exists: 'attached (in storage)', stored: 'stored',
};
const dash = (v) => (v === null || v === undefined || v === '' ? '∅' : fmt(v));

/** The reasons that are not field names (those are on the "fields" line); new proof points counted. */
function otherChanges(a) {
  const fields = new Set(a.changes.map((c) => c.field));
  const rest = a.reasons.filter((r) => !fields.has(r));
  const fresh = rest.filter((r) => /^proof point .* \(new\)$/.test(r)).length;
  const named = { slug: 'slug set', company_id: 'company linked', source: 'source=import', proof_points: 'proof-point wording' };
  const out = rest.filter((r) => !/^proof point .* \(new\)$/.test(r)).map((r) => named[/** @type {keyof typeof named} */ (r)] ?? r);
  if (fresh) out.push(`${fresh} proof point${fresh === 1 ? '' : 's'} not stored yet`);
  return out;
}

function printHuman(d) {
  console.log(`${d.mode === 'dry_run' ? 'Dry run' : 'Import'} · ${d.totals.applications} applications · ${d.today}`);
  console.log(`  history ${d.history}`);
  console.log(`  maps    ${d.maps}`);
  for (const a of d.applications) {
    const head = a.action === 'create' ? 'create (new row)' : a.action === 'adopt' ? `adopt #${a.id} (by ${a.matched_by ? a.matched_by.replace('_', ' + ') : 'explicit id'})` : `update #${a.id}`;
    const verdict = a.result ? a.result : a.reasons.length ? 'would change' : 'unchanged';
    console.log(`\n${a.slug}  ·  ${head}  ·  ${verdict}`);
    const cs = { linked: 'linked', would_create: 'would create', would_link_new: 'would link to the one created above', not_created: 'not created: kept as text' }[a.company.status] ?? a.company.status;
    console.log(`  company   ${a.company.name} (${cs})`);
    const ph = a.phase;
    const phase = ph.from === null ? ph.to : ph.from === ph.to ? `${ph.to} (unchanged)` : `${ph.from} → ${ph.to}`;
    const sent = ph.applied_on.from === ph.applied_on.to ? dash(ph.applied_on.to) : `${dash(ph.applied_on.from)} → ${dash(ph.applied_on.to)}`;
    console.log(`  phase     ${phase}; sent ${sent}${ph.note ? ` (${ph.note})` : ''}${a.uncertain.length ? `; unconfirmed: ${a.uncertain.join(', ')}` : ''}`);
    if (a.action !== 'create') console.log(`  fields    ${a.changes.length ? a.changes.map((c) => c.field).join(', ') : 'no changes'}`);
    const f = a.fit;
    const topics = f.topics.length ? f.topics.map((t) => `${t.topic}${t.gap_state !== 'open' ? `[${t.gap_state}]` : ''}`).join(', ') : 'none';
    console.log(`  fit       ${f.met} met, ${f.gap} gap${f.gap === 1 ? '' : 's'}, ${f.caution} caution${f.caution === 1 ? '' : 's'}; gap topics: ${topics}`);
    console.log(`  proof     ${a.proof_points.length ? a.proof_points.join(', ') : 'none'}`);
    const ev = a.events;
    console.log(`  events    ${ev.new.length} new${ev.existing ? `, ${ev.existing} already logged` : ''}${ev.new.length ? `: ${ev.new.map((e) => `${e.kind} ${e.on}`).join(', ')}` : ''}`);
    if (a.answers.total) console.log(`  answers   ${a.answers.total} (${a.answers.saved} with text)`);
    if (a.documents.length) console.log(`  files     ${a.documents.map((x) => `${x.kind} ${DOC_STATUS[x.status] ?? x.status}${x.size ? ` ${formatBytes(x.size)}` : ''}`).join('; ')}`);
    if (a.reasons.length && !a.result && a.action !== 'create') console.log(`  also      ${otherChanges(a).join(', ')}`);
    for (const w of a.warnings) console.log(`  warning   ${w}`);
  }
  const t = d.totals;
  console.log(`\n${t.create} to create, ${t.adopt} to adopt, ${t.update} to update; ${t.would_change} would change, ${t.unchanged} unchanged; ${t.uploads} file${t.uploads === 1 ? '' : 's'} to upload (${formatBytes(t.upload_bytes) || '0 B'}).`);
  console.log(`Left alone: ${d.left_alone.ids.map((x) => `#${x}`).join(', ') || 'none'}${d.left_alone.touched.length ? `; CHANGED: ${d.left_alone.touched.join(', ')}` : '; untouched'}.`);
  if (d.fixture) console.log(`Fixture: ${d.fixture.file} (${d.fixture.apps} applications, ${d.fixture.events} events).`);
  if (d.mode === 'dry_run') console.log('Nothing was written.');
}
