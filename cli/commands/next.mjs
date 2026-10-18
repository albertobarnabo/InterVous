// intervous next <ref> "text" [--due DATE] | intervous next <ref> --clear
import { jobUrl, resolveJob } from '../lib/jobs.mjs';
import { emitWrite, usage } from '../lib/output.mjs';
import { updateJob } from '../lib/timeline.mjs';
import { checkDate } from '../lib/validate.mjs';

export const options = {
  due: { type: 'string' },
  clear: { type: 'boolean' },
};

export async function run(ctx, pos, flags) {
  const [ref, text] = pos;
  const ok = flags.clear ? pos.length === 1 : pos.length === 2 && text.trim();
  if (!ok) throw usage('next takes <ref> "text" [--due DATE], or <ref> --clear', 'intervous next apple "Record the interview outcome" --due 2026-10-24');
  if (flags.due) checkDate(flags.due, '--due');
  if (flags.clear && flags.due) throw usage('--clear and --due do not go together');
  const job = await resolveJob(ctx, ref);
  const patch = flags.clear ? { next_action: null, next_action_due: null } : { next_action: text.trim(), next_action_due: flags.due ?? null };
  const after = await updateJob(ctx, job.id, patch);
  const data = { id: job.id, slug: job.slug, company: job.company_name, next_action: after.next_action, next_action_due: after.next_action_due, url: jobUrl(ctx, job), warnings: [] };
  emitWrite(ctx, data, (d) => console.log(d.next_action ? `Next for ${d.company}: ${d.next_action}${d.next_action_due ? ` (due ${d.next_action_due})` : ''}` : `Cleared the next action for ${d.company}.`));
}
