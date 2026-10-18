// intervous answer <ref> --question Q (--file F | --text T) [--limit N] [--submitted] [--source S]
// Saves an application answer. The same question (case-insensitive) is updated in place.
import { readLocalFile, resolvePath } from '../lib/files.mjs';
import { jobUrl, resolveJob } from '../lib/jobs.mjs';
import { emitWrite, invalid, must, usage } from '../lib/output.mjs';

export const options = {
  question: { type: 'string' },
  file: { type: 'string' },
  text: { type: 'string' },
  limit: { type: 'string' },
  submitted: { type: 'boolean' },
  source: { type: 'string' },
};

export async function run(ctx, pos, flags) {
  if (pos.length !== 1 || !flags.question || (!flags.file && flags.text === undefined) || (flags.file && flags.text !== undefined)) {
    throw usage('answer takes <ref> --question Q and one of --file F / --text T', 'intervous answer <ref> --question "Why Databricks?" --file answers/why.md --limit 1200');
  }
  let limit = null;
  if (flags.limit !== undefined) {
    limit = Number(flags.limit);
    if (!Number.isInteger(limit) || limit < 1) throw invalid('--limit must be a whole number of characters');
  }
  const job = await resolveJob(ctx, pos[0]);
  let text;
  let sourcePath = flags.source ?? null;
  if (flags.file) {
    const f = readLocalFile(resolvePath(flags.file), '--file');
    text = f.buf.toString('utf8').replace(/\s+$/, '');
    sourcePath ??= f.path;
  } else text = String(flags.text);
  /** @type {string[]} */ const warnings = [];
  if (limit && text.length > limit) warnings.push(`the answer is ${text.length} characters, over the ${limit} limit`);

  const sb = ctx.sb;
  const all = must(await sb.from('job_answers').select('*').eq('job_id', job.id).order('position'), 'load answers');
  const q = flags.question.trim();
  const same = all.find((a) => a.question.trim().toLowerCase() === q.toLowerCase());
  /** @type {Record<string, any>} */
  const patch = { answer: text, source_path: sourcePath };
  if (limit !== null) patch.char_limit = limit;
  if (flags.submitted) patch.submitted = true;
  const row = same
    ? must(await sb.from('job_answers').update(patch).eq('id', same.id).select('*').single(), 'update the answer')
    : must(await sb.from('job_answers').insert({ job_id: job.id, question: q, position: all.length ? Math.max(...all.map((a) => a.position)) + 1 : 0, ...patch }).select('*').single(), 'save the answer');
  const data = {
    id: job.id, slug: job.slug, company: job.company_name,
    answer: { id: row.id, question: row.question, characters: text.length, char_limit: row.char_limit, submitted: row.submitted, source_path: row.source_path, status: same ? 'updated' : 'added' },
    url: jobUrl(ctx, job), warnings,
  };
  emitWrite(ctx, data, (d) => console.log(`${d.answer.status === 'updated' ? 'Updated' : 'Saved'} the answer to "${d.answer.question}" for ${d.company} (${d.answer.characters}${d.answer.char_limit ? `/${d.answer.char_limit}` : ''} characters)`));
}
