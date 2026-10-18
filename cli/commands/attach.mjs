// intervous attach <ref> <file> --kind cv_pdf|cv_source|cover_letter|other [--submitted] [--label L]
// Uploads a file to the private bucket and attaches it to the application. The same file twice is
// one document (deduplicated by content hash).
import { FILE_KINDS, formatBytes, mimeFor, objectPath, readLocalFile, resolvePath, uploadObject } from '../lib/files.mjs';
import { jobUrl, resolveJob } from '../lib/jobs.mjs';
import { emitWrite, must, usage } from '../lib/output.mjs';
import { checkOneOf } from '../lib/validate.mjs';

export const options = {
  kind: { type: 'string' },
  submitted: { type: 'boolean' },
  label: { type: 'string' },
};

export async function run(ctx, pos, flags) {
  if (pos.length !== 2 || !flags.kind) throw usage('attach takes <ref> <file> --kind KIND', `intervous attach <ref> cover.pdf --kind ${FILE_KINDS.join('|')} [--submitted] [--label L]`);
  const kind = checkOneOf(flags.kind, FILE_KINDS, '--kind');
  const job = await resolveJob(ctx, pos[0]);
  const f = readLocalFile(resolvePath(pos[1]), 'file');
  const mime = mimeFor(kind, f.path);
  const uid = await ctx.uid();
  const name = objectPath(uid, job.slug ?? `job-${job.id}`, kind, f.sha256, f.path);
  const status = await uploadObject(ctx.sb, name, f.buf, mime);
  /** @type {Record<string, any>} */
  const row = { job_id: job.id, kind, storage_path: name, mime_type: mime, size_bytes: f.size, sha256: f.sha256 };
  if (flags.submitted) row.submitted = true;
  if (flags.label !== undefined) row.label = flags.label;
  const doc = must(await ctx.sb.from('job_documents').upsert(row, { onConflict: 'job_id,kind,sha256' }).select('*').single(), 'attach the file');
  const data = { id: job.id, slug: job.slug, company: job.company_name, document: { id: doc.id, kind, status, path: name, size_bytes: f.size, submitted: doc.submitted, label: doc.label }, url: jobUrl(ctx, job), warnings: [] };
  emitWrite(ctx, data, (d) => console.log(`Attached ${kind} to ${d.company}: ${d.document.path} (${formatBytes(f.size)}, ${status === 'exists' ? 'already in storage' : 'uploaded'})`));
}
