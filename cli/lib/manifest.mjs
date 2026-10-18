// The manifest (spec 6.3) and the one write path behind `add` (and the history import, WP4).
//
// A manifest is the RPC payload of iv_upsert_application plus `files` and `answers[].file`.
// Relative paths resolve against the manifest's folder.
//
//   const prepared = prepareApplication(manifest, { baseDir, today });   // validate, read files (offline)
//   const result = await pushApplication(ctx, prepared, { dryRun });      // upload, then one RPC call
import fs from 'node:fs';
import path from 'node:path';
import { escapeLike, normalizeUrl } from '../../lib/core/index.mjs';
import { mimeFor, objectExists, objectPath, readLocalFile, resolvePath, sha256, uploadObject } from './files.mjs';
import { jobUrl } from './jobs.mjs';
import { conflict, invalid, must, notFound } from './output.mjs';
import { MANIFEST_KEYS, validatePayload } from './validate.mjs';

/** `files` keys and the document kind each one becomes. */
export const FILE_KEYS = Object.freeze({ cv_pdf: 'cv_pdf', cv_source: 'cv_source', cover_letter: 'cover_letter', other: 'other', jd_md: 'jd_snapshot' });

/**
 * Read and parse a manifest file.
 * @param {string} file
 * @returns {{ manifest: Record<string, any>, baseDir: string, file: string }}
 */
export function loadManifest(file) {
  const abs = resolvePath(file);
  let text;
  try {
    text = fs.readFileSync(abs, 'utf8');
  } catch {
    throw invalid(`No such manifest: ${abs}`);
  }
  let manifest;
  try {
    manifest = JSON.parse(text);
  } catch (e) {
    throw invalid(`${abs} is not valid JSON: ${/** @type {Error} */ (e).message}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw invalid(`${abs} must hold one JSON object`);
  return { manifest, baseDir: path.dirname(abs), file: abs };
}

/**
 * @typedef {object} PreparedFile
 * @property {string} kind      cv_pdf | cv_source | cover_letter | other
 * @property {string} file      absolute path
 * @property {Buffer} buf
 * @property {number} size
 * @property {string} sha256
 * @property {string} mime
 * @property {string | null | undefined} label
 * @property {boolean | null | undefined} submitted
 *
 * @typedef {object} Prepared
 * @property {Record<string, any>} payload   the RPC payload, without `documents` for the files below
 * @property {PreparedFile[]} uploads         files for the bucket
 * @property {Array<Record<string, any>>} inline  documents stored inline (the JD snapshot)
 * @property {string[]} warnings
 */

/**
 * Validate a manifest and read every local file it names. No network.
 * @param {Record<string, any>} manifest
 * @param {{ baseDir?: string, today: string, requireCompanyRole?: boolean, fillAppliedOn?: boolean }} opts
 * @returns {Prepared}
 */
export function prepareApplication(manifest, opts) {
  const baseDir = opts.baseDir ?? process.cwd();
  const raw = { ...manifest };
  const files = raw.files ?? {};
  for (const k of MANIFEST_KEYS) delete raw[k];
  if (files && (typeof files !== 'object' || Array.isArray(files))) throw invalid('files must be an object {cv_pdf, cv_source, jd_md}');

  // answers[].file -> answer
  if (Array.isArray(raw.answers)) {
    raw.answers = raw.answers.map((a, i) => {
      if (!a || typeof a !== 'object' || a.file === undefined || a.file === null) return a;
      if (a.answer !== undefined && a.answer !== null) throw invalid(`answers[${i}] has both answer and file; keep one`);
      const abs = resolvePath(a.file, baseDir);
      const text = readLocalFile(abs, `answers[${i}].file`).buf.toString('utf8').replace(/\s+$/, '');
      const rest = { ...a };
      delete rest.file;
      return { ...rest, answer: text, source_path: a.source_path ?? abs };
    });
  }

  const { payload, warnings } = validatePayload(raw, { today: opts.today, requireCompanyRole: opts.requireCompanyRole ?? true, fillAppliedOn: opts.fillAppliedOn });

  /** @type {PreparedFile[]} */ const uploads = [];
  /** @type {Array<Record<string, any>>} */ const inline = [];
  for (const [key, spec] of Object.entries(files ?? {})) {
    if (spec === null || spec === undefined || spec === '') continue;
    const kind = FILE_KEYS[/** @type {keyof typeof FILE_KEYS} */ (key)];
    if (!kind) throw invalid(`files.${key} is not a known file kind (${Object.keys(FILE_KEYS).join(', ')})`);
    const s = typeof spec === 'string' ? { path: spec } : spec;
    if (!s || typeof s !== 'object' || typeof s.path !== 'string') throw invalid(`files.${key} must be a path or {path, label, submitted}`);
    const f = readLocalFile(resolvePath(s.path, baseDir), `files.${key}`);
    if (kind === 'jd_snapshot') {
      const content = f.buf.toString('utf8');
      if (!content.trim()) throw invalid(`files.${key} is empty: ${f.path}`);
      inline.push({
        kind, content, sha256: sha256(Buffer.from(content, 'utf8')), mime_type: 'text/markdown', size_bytes: f.size,
        source_url: s.source_url ?? payload.url ?? null, captured_at: s.captured_at ?? f.mtime.toISOString(), label: s.label ?? null,
      });
    } else {
      uploads.push({ kind, file: f.path, buf: f.buf, size: f.size, sha256: f.sha256, mime: mimeFor(kind, f.path), label: s.label, submitted: s.submitted });
    }
  }
  return { payload, uploads, inline, warnings };
}

/**
 * The row the RPC would write to: by slug; else the explicit job_id; else a slug-less row with the
 * same URL (normalised exactly as the RPC does).
 * @returns {Promise<{ job: any | null, match: 'slug' | 'job_id' | 'url' | null }>}
 */
export async function findStoredJob(ctx, payload) {
  const sb = ctx.sb;
  const uid = await ctx.uid();
  const bySlug = must(await sb.from('jobs').select('*').eq('user_id', uid).eq('slug', payload.slug).maybeSingle(), 'look up the slug');
  if (bySlug) return { job: bySlug, match: 'slug' };
  if (payload.job_id) {
    const byId = must(await sb.from('jobs').select('*').eq('user_id', uid).eq('id', payload.job_id).maybeSingle(), 'look up job_id');
    if (!byId) throw notFound(`job_id ${payload.job_id} does not exist`);
    if (byId.slug && byId.slug !== payload.slug) throw conflict(`job ${byId.id} already has slug ${byId.slug}`, 'Use that slug, or drop job_id.');
    return { job: byId, match: 'job_id' };
  }
  const norm = normalizeUrl(payload.url);
  if (norm) {
    const rows = must(await sb.from('jobs').select('*').eq('user_id', uid).is('slug', null).ilike('url', `${escapeLike(norm)}%`).order('id'), 'look up the URL');
    const hit = rows.find((r) => normalizeUrl(r.url) === norm);
    if (hit) return { job: hit, match: 'url' };
  }
  return { job: null, match: null };
}

/** Other applications (with a different slug) that have the same posting URL. */
async function sameUrlElsewhere(ctx, payload) {
  const norm = normalizeUrl(payload.url);
  if (!norm) return [];
  const uid = await ctx.uid();
  const rows = must(await ctx.sb.from('jobs').select('id, slug, company_name, role, url').eq('user_id', uid).ilike('url', `${escapeLike(norm)}%`), 'look up the URL');
  return rows.filter((r) => normalizeUrl(r.url) === norm && r.slug && r.slug !== payload.slug);
}

async function companyMatch(ctx, name) {
  if (!name || !String(name).trim()) return null;
  const n = String(name).trim();
  const rows = must(await ctx.sb.from('companies').select('id, name').ilike('name', escapeLike(n)).order('name').order('id'), 'look up the company');
  return rows.find((c) => String(c.name).trim().toLowerCase() === n.toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------
// dry-run diff
// ---------------------------------------------------------------------------

const SCALARS = [
  'team', 'work_mode', 'country_code', 'channel', 'channel_detail', 'role_family', 'seniority', 'years_required',
  'visa_needed', 'applied_on', 'cv_built_on', 'closes_on', 'cv_variant', 'notes', 'status_evidence',
];

function same(a, b) {
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  if (typeof a === 'string' && typeof b === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(a) && /^\d{4}-\d{2}-\d{2}T/.test(b)) {
    return new Date(a).getTime() === new Date(b).getTime();
  }
  return a === b;
}

/** Field-level changes the RPC would make to `job` (null = a new row). */
export function diffJob(job, p, companyName) {
  const cur = job ?? {};
  /** @type {Array<{ field: string, from: any, to: any }>} */ const changes = [];
  const put = (field, to) => {
    const from = cur[field] ?? null;
    if (!same(from, to)) changes.push({ field, from, to: to ?? null });
  };
  const has = (k) => Object.prototype.hasOwnProperty.call(p, k);
  if (companyName && !(job && String(cur.company_name ?? '').toLowerCase() === companyName.toLowerCase())) put('company_name', companyName);
  if (p.role) put('role', p.role);
  if (has('location') || !job) put('location', p.location ?? '');
  if (has('url') || !job) put('url', p.url ?? '');
  if (p.phase) put('phase', p.phase);
  else if (!job) put('phase', 'draft');
  for (const k of SCALARS) if (has(k)) put(k, p[k]);
  if (has('uncertain')) put('uncertain', p.uncertain ?? []);
  if (has('salary')) {
    const s = p.salary ?? {};
    put('salary_text', s.text ?? null);
    put('salary_min', s.min ?? null);
    put('salary_max', s.max ?? null);
    put('salary_currency', s.currency ?? null);
    put('salary_period', s.period ?? null);
  }
  if (has('posting')) {
    put('posting_live', p.posting?.live ?? null);
    put('posting_checked_at', p.posting?.checked_at ?? null);
  }
  if (has('next_action')) {
    put('next_action', p.next_action?.text ?? null);
    put('next_action_due', p.next_action?.due ?? null);
  }
  return changes;
}

function diffList(stored, next, keyOf, what) {
  const a = new Map(stored.map((r) => [keyOf(r), r]));
  const b = new Map(next.map((r) => [keyOf(r), r]));
  return {
    from: stored.length,
    to: next.length,
    added: [...b.keys()].filter((k) => !a.has(k)),
    removed: [...a.keys()].filter((k) => !b.has(k)),
    changed: [...b.keys()].filter((k) => a.has(k) && what(a.get(k), b.get(k))),
  };
}

const lower = (s) => String(s ?? '').trim().toLowerCase();

async function diffChildren(ctx, job, p) {
  const sb = ctx.sb;
  const id = job?.id;
  const load = async (table, cols) => (id ? must(await sb.from(table).select(cols).eq('job_id', id), `load ${table}`) : []);
  /** @type {Record<string, any>} */ const lists = {};
  if (p.requirements) {
    const stored = await load('job_requirements', 'requirement, verdict, topic, gap_state, evidence, importance, anchor_text');
    lists.requirements = diffList(stored, p.requirements, (r) => lower(r.requirement), (x, y) =>
      x.verdict !== y.verdict || (x.topic ?? null) !== (y.topic ?? null) || (y.gap_state !== undefined && (x.gap_state ?? null) !== (y.gap_state ?? null)) ||
      (x.evidence ?? null) !== (y.evidence ?? null) || (x.anchor_text ?? null) !== (y.anchor_text ?? null));
  }
  if (p.answers) {
    const stored = await load('job_answers', 'question, answer, char_limit');
    lists.answers = diffList(stored, p.answers, (r) => lower(r.question), (x, y) => y.answer != null && x.answer !== y.answer);
  }
  if (p.proof_points) {
    const stored = id ? must(await sb.from('job_proof_points').select('detail, proof_point:proof_points(key)').eq('job_id', id), 'load proof points') : [];
    lists.proof_points = diffList(stored.map((r) => ({ key: r.proof_point?.key, detail: r.detail })), p.proof_points, (r) => r.key, (x, y) => (x.detail ?? null) !== (y.detail ?? null));
  }
  if (p.contacts) {
    const stored = await load('contacts', 'name, role, email');
    lists.contacts = diffList(stored, p.contacts, (r) => lower(r.name), (x, y) => (x.role ?? null) !== (y.role ?? null) || (x.email ?? null) !== (y.email ?? null));
  }
  if (p.events) {
    const stored = await load('job_events', 'kind, occurred_on, title');
    const seen = new Set(stored.map((e) => `${e.kind}|${e.occurred_on}|${e.title ?? ''}`));
    const fresh = p.events.filter((e) => !seen.has(`${e.kind}|${e.on}|${e.title ?? ''}`));
    lists.events = { existing: p.events.length - fresh.length, new: fresh.map((e) => ({ kind: e.kind, on: e.on, title: e.title ?? null })) };
  }
  return lists;
}

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

/**
 * Upload the files, then write everything with one iv_upsert_application call (one transaction).
 * If the RPC fails the uploaded objects stay: a re-run reuses them (the name comes from the hash).
 * @param {any} ctx  command context (cli/lib/auth.mjs makeContext)
 * @param {Prepared} prepared
 * @param {{ dryRun?: boolean }} [opts]
 */
export async function pushApplication(ctx, prepared, opts = {}) {
  const sb = ctx.sb;
  const uid = await ctx.uid();
  const p = structuredClone(prepared.payload);
  const warnings = [...prepared.warnings];
  p.source ??= 'cli';

  const { job, match } = await findStoredJob(ctx, p);
  for (const other of await sameUrlElsewhere(ctx, p)) {
    warnings.push(`${other.slug} (#${other.id}, ${other.company_name}) has the same posting URL. If it is the same job, use that slug instead.`);
  }
  const storedDocs = job ? must(await sb.from('job_documents').select('kind, sha256, storage_path').eq('job_id', job.id), 'load documents') : [];
  const known = new Set(storedDocs.map((d) => `${d.kind}|${d.sha256}`));

  /** @type {Array<Record<string, any>>} */ const documents = [];
  /** @type {Array<{ kind: string, status: string, path?: string, size?: number, file?: string }>} */ const report = [];
  for (const u of prepared.uploads) {
    const name = objectPath(uid, p.slug, u.kind, u.sha256, u.file);
    const attached = known.has(`${u.kind}|${u.sha256}`) && storedDocs.some((d) => d.storage_path === name);
    let status;
    if (attached) status = 'unchanged';
    else if (opts.dryRun) status = (await objectExists(sb, name)) ? 'would_attach' : 'would_upload';
    else status = await uploadObject(sb, name, u.buf, u.mime);
    const doc = { kind: u.kind, storage_path: name, mime_type: u.mime, size_bytes: u.size, sha256: u.sha256 };
    if (u.label !== undefined) doc.label = u.label;
    if (u.submitted !== undefined) doc.submitted = u.submitted;
    documents.push(doc);
    report.push({ kind: u.kind, status, path: name, size: u.size, file: u.file });
  }
  for (const d of prepared.inline) {
    documents.push(d);
    const status = known.has(`${d.kind}|${d.sha256}`) ? 'unchanged' : opts.dryRun ? 'would_store' : 'stored';
    report.push({ kind: d.kind, status, size: d.size_bytes });
  }
  if (documents.length) p.documents = [...(Array.isArray(p.documents) ? p.documents : []), ...documents];

  if (opts.dryRun) {
    const company = p.company ? await companyMatch(ctx, p.company) : null;
    const companyName = company?.name ?? (p.company ? String(p.company).trim() : null);
    const companyStatus = !p.company ? 'unchanged' : company ? 'linked' : p.company_create === false ? 'not_created' : 'would_create';
    return {
      action: job ? 'would_update' : 'would_create',
      id: job?.id ?? null,
      slug: p.slug,
      match,
      adopt: match === 'job_id' || match === 'url',
      company: { name: companyName, status: companyStatus },
      changes: diffJob(job, p, companyName),
      lists: await diffChildren(ctx, job, p),
      documents: report,
      url: jobUrl(ctx, { id: job?.id ?? null, slug: p.slug }),
      warnings,
    };
  }

  const res = must(await sb.rpc('iv_upsert_application', { p }), 'write the application');
  return {
    id: res.id,
    slug: res.slug,
    created: res.created,
    adopted: res.adopted,
    phase: res.phase,
    company: res.company,
    company_created: res.company_created,
    documents: report.map((r) => ({ kind: r.kind, status: r.status, ...(r.path ? { path: r.path } : {}) })),
    url: jobUrl(ctx, res),
    warnings,
  };
}
