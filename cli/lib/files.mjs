// Local files and the private bucket.
//
// Stored objects are named <uid>/<slug>/<kind>/<sha256[0:12]>-<basename> (spec 6.3), so the same
// file always lands on the same name: a re-run reuses it, and "already exists" counts as success.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { BUCKET } from './config.mjs';
import { fromSupabase, invalid } from './output.mjs';

/** What the bucket accepts (migration section 9), by file extension. */
export const MIME_BY_EXT = Object.freeze({
  '.pdf': 'application/pdf',
  '.tex': 'application/x-tex',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.json': 'application/json',
});

/** The kinds stored as files in the bucket (jd_snapshot is stored inline as text). */
export const FILE_KINDS = Object.freeze(['cv_pdf', 'cv_source', 'cover_letter', 'other']);

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** Resolve `p` against `baseDir` (relative paths in a manifest resolve against its folder; ~ is home). */
export function resolvePath(p, baseDir = process.cwd()) {
  const s = String(p);
  if (s === '~' || s.startsWith('~/')) return path.join(process.env.HOME ?? '', s.slice(1));
  return path.resolve(baseDir, s);
}

/**
 * Read a local file for upload or inline storage.
 * @param {string} file absolute path
 * @param {string} label for error messages, e.g. 'files.cv_pdf'
 */
export function readLocalFile(file, label = 'file') {
  let st;
  try {
    st = fs.statSync(file);
  } catch {
    throw invalid(`${label}: no such file ${file}`);
  }
  if (!st.isFile()) throw invalid(`${label}: not a file: ${file}`);
  const buf = fs.readFileSync(file);
  return { path: file, buf, size: st.size, mtime: st.mtime, sha256: sha256(buf) };
}

/** MIME type for a file of `kind` (cv_pdf is always a PDF, cv_source always LaTeX). */
export function mimeFor(kind, file) {
  const ext = path.extname(file).toLowerCase();
  if (kind === 'cv_pdf') {
    if (ext !== '.pdf') throw invalid(`A cv_pdf must be a .pdf file, got ${path.basename(file)}`);
    return 'application/pdf';
  }
  if (kind === 'cv_source' && ext === '.tex') return 'application/x-tex';
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw invalid(`The bucket does not accept ${ext || 'files without an extension'} (${path.basename(file)})`, `Allowed: ${Object.keys(MIME_BY_EXT).join(' ')}. Convert it to PDF first.`);
  }
  return mime;
}

/** A storage-safe version of a file name: letters, digits, dot, dash and underscore. */
export function safeBasename(file) {
  const base = path.basename(file).normalize('NFKD').replace(/[̀-ͯ]/g, '');
  const clean = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return (clean || 'file').slice(0, 120);
}

/** <uid>/<slug>/<kind>/<sha256[0:12]>-<basename> */
export function objectPath(uid, slug, kind, sha, file) {
  return `${uid}/${slug}/${kind}/${sha.slice(0, 12)}-${safeBasename(file)}`;
}

/**
 * Upload with upsert:false. Returns 'uploaded', or 'exists' when the object is already there.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
export async function uploadObject(sb, objectName, buf, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(objectName, buf, { contentType, upsert: false });
  if (!error) return 'uploaded';
  const status = Number(/** @type {any} */ (error).statusCode ?? /** @type {any} */ (error).status ?? 0);
  if (status === 409 || /already exists|duplicate/i.test(error.message)) return 'exists';
  throw fromSupabase(error, `upload ${objectName}`);
}

/**
 * Does the object exist? (read-only: lists its folder)
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
export async function objectExists(sb, objectName) {
  const dir = objectName.slice(0, objectName.lastIndexOf('/'));
  const name = objectName.slice(objectName.lastIndexOf('/') + 1);
  const { data, error } = await sb.storage.from(BUCKET).list(dir, { limit: 1000, search: name });
  if (error) throw fromSupabase(error, `list ${dir}`);
  return (data ?? []).some((o) => o.name === name);
}

/**
 * Every object under a prefix, recursively (folders have no id).
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @returns {Promise<Array<{ name: string, size: number | null, updated_at: string | null }>>}
 */
export async function listObjects(sb, prefix, depth = 4) {
  const out = [];
  const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw fromSupabase(error, `list ${prefix}`);
  for (const o of data ?? []) {
    const full = `${prefix}/${o.name}`;
    if (o.id === null || o.id === undefined) {
      if (depth > 0) out.push(...(await listObjects(sb, full, depth - 1)));
    } else out.push({ name: full, size: o.metadata?.size ?? null, updated_at: o.updated_at ?? null });
  }
  return out;
}

/** 'application/pdf, 84 KB' style size. */
export function formatBytes(n) {
  if (n === null || n === undefined) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
