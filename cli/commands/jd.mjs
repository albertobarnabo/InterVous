// intervous jd <ref> <file.md> [--source-url U] [--captured-at ISO] [--label L]
// Stores the job description as captured, inline as Markdown (the dossier's JD tab reads it).
import { readLocalFile, resolvePath, sha256 } from '../lib/files.mjs';
import { jobUrl, resolveJob } from '../lib/jobs.mjs';
import { emitWrite, invalid, must, usage } from '../lib/output.mjs';
import { checkTimestamp } from '../lib/validate.mjs';

export const options = {
  'source-url': { type: 'string' },
  'captured-at': { type: 'string' },
  label: { type: 'string' },
};

export async function run(ctx, pos, flags) {
  if (pos.length !== 2) throw usage('jd takes <ref> <file.md>', 'intervous jd <ref> applications/<slug>/jd.md [--source-url U] [--captured-at ISO]');
  if (flags['captured-at']) checkTimestamp(flags['captured-at'], '--captured-at');
  if (flags['source-url'] && !/^https?:\/\/\S+$/i.test(flags['source-url'])) throw invalid('--source-url must start with http:// or https://');
  const job = await resolveJob(ctx, pos[0]);
  const f = readLocalFile(resolvePath(pos[1]), 'file');
  const content = f.buf.toString('utf8');
  if (!content.trim()) throw invalid(`${f.path} is empty`);
  const hash = sha256(Buffer.from(content, 'utf8'));
  const existing = must(await ctx.sb.from('job_documents').select('id').eq('job_id', job.id).eq('kind', 'jd_snapshot').eq('sha256', hash).limit(1), 'check documents');
  /** @type {Record<string, any>} */
  const row = {
    job_id: job.id, kind: 'jd_snapshot', content, sha256: hash, mime_type: 'text/markdown', size_bytes: f.size,
    source_url: flags['source-url'] ?? (job.url || null), captured_at: flags['captured-at'] ?? f.mtime.toISOString(),
  };
  if (flags.label !== undefined) row.label = flags.label;
  const doc = must(await ctx.sb.from('job_documents').upsert(row, { onConflict: 'job_id,kind,sha256' }).select('id, captured_at, source_url, label').single(), 'store the JD');
  const data = {
    id: job.id, slug: job.slug, company: job.company_name,
    document: { id: doc.id, kind: 'jd_snapshot', status: existing.length ? 'unchanged' : 'stored', characters: content.length, captured_at: doc.captured_at, source_url: doc.source_url, label: doc.label },
    url: jobUrl(ctx, job), warnings: [],
  };
  emitWrite(ctx, data, (d) => console.log(`${d.document.status === 'unchanged' ? 'Already stored' : 'Stored'}: the JD for ${d.company} (${d.document.characters.toLocaleString('en')} characters)`));
}
