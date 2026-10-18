// intervous open <ref>: prints the dossier link (<appUrl>/applications/<slug>).
import { jobUrl, resolveJob } from '../lib/jobs.mjs';
import { emitRead, usage } from '../lib/output.mjs';

export const options = {};

export async function run(ctx, pos) {
  if (pos.length !== 1) throw usage('open takes one <ref>');
  const job = await resolveJob(ctx, pos[0]);
  emitRead(ctx, { id: job.id, slug: job.slug, url: jobUrl(ctx, job) }, (d) => console.log(d.url));
}
