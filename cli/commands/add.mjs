// intervous add <manifest.json> [--dry-run]
// The whole application in one call (spec 6.3): validate, upload cv_pdf / cv_source to the bucket,
// read jd_md and answers[].file, then one iv_upsert_application call (one transaction).
// --dry-run resolves everything, writes nothing, and prints the field-level diff.
import { formatBytes } from '../lib/files.mjs';
import { todayFor } from '../lib/jobs.mjs';
import { loadManifest, prepareApplication, pushApplication } from '../lib/manifest.mjs';
import { emitWrite, fmt, usage } from '../lib/output.mjs';

export const options = {
  'dry-run': { type: 'boolean' },
};

const STATUS_TEXT = {
  uploaded: 'uploaded', exists: 'already in storage', unchanged: 'unchanged', stored: 'stored',
  would_upload: 'would upload', would_attach: 'would attach (already in storage)', would_store: 'would store',
};

export async function run(ctx, pos, flags) {
  if (pos.length !== 1) throw usage('add takes one manifest file', 'intervous add applications/<slug>/intervous.json [--dry-run]');
  const { manifest, baseDir } = loadManifest(pos[0]);
  const today = await todayFor(ctx);
  const prepared = prepareApplication(manifest, { baseDir, today });
  const result = await pushApplication(ctx, prepared, { dryRun: Boolean(flags['dry-run']) });
  emitWrite(ctx, result, flags['dry-run'] ? printDryRun : printAdded);
}

function printDocs(docs) {
  for (const d of docs) console.log(`  ${d.kind.padEnd(12)} ${STATUS_TEXT[d.status] ?? d.status}${d.path ? `  ${d.path}` : ''}${d.size ? `  (${formatBytes(d.size)})` : ''}`);
}

function printAdded(r) {
  const verb = r.created ? 'Created' : r.adopted ? 'Adopted' : 'Updated';
  console.log(`${verb} ${r.company} (#${r.id}, ${r.slug}), phase ${r.phase}${r.company_created ? `; new company "${r.company}"` : ''}`);
  printDocs(r.documents);
  console.log(r.url);
}

function printDryRun(r) {
  const head = r.action === 'would_create' ? `Would create ${r.slug}` : `Would update #${r.id} (${r.slug}, matched by ${r.match}${r.adopt ? ', adopting it' : ''})`;
  console.log(head);
  if (r.company?.name) console.log(`  company      ${r.company.name} (${r.company.status.replace('_', ' ')})`);
  if (r.changes.length) {
    console.log(r.action === 'would_create' ? '  fields' : '  changes');
    const w = Math.max(...r.changes.map((c) => c.field.length));
    for (const c of r.changes) {
      const to = fmt(c.to);
      console.log(r.action === 'would_create'
        ? `    ${c.field.padEnd(w)}  ${to.length > 70 ? `${to.slice(0, 69)}…` : to}`
        : `    ${c.field.padEnd(w)}  ${short(c.from)} → ${short(c.to)}`);
    }
  } else if (r.action === 'would_update') console.log('  no field changes');
  for (const [name, l] of Object.entries(r.lists)) {
    if (name === 'events') {
      console.log(`  events       ${l.new.length} new, ${l.existing} already logged${l.new.length ? `: ${l.new.map((e) => `${e.kind} ${e.on}`).join(', ')}` : ''}`);
      continue;
    }
    const bits = [`${l.from} → ${l.to}`];
    if (l.added.length) bits.push(`+${l.added.length}`);
    if (l.removed.length) bits.push(`−${l.removed.length}`);
    if (l.changed.length) bits.push(`${l.changed.length} changed`);
    console.log(`  ${name.padEnd(12)} ${bits.join(', ')}`);
  }
  printDocs(r.documents);
  console.log('Nothing was written.');
}

const short = (v) => {
  const s = v === null || v === undefined || v === '' ? '∅' : fmt(v);
  return s.length > 40 ? `${s.slice(0, 39)}…` : s;
};
