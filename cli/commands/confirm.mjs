// intervous confirm <ref> <field...>
// Removes the fields from `uncertain` (they are now confirmed) and writes a note event saying so.
import { jobUrl, resolveJob } from '../lib/jobs.mjs';
import { emitWrite, usage } from '../lib/output.mjs';
import { eventDate, insertEvent, updateJob, withoutFields } from '../lib/timeline.mjs';

export const options = {
  note: { type: 'string' },
};

export async function run(ctx, pos, flags) {
  const [ref, ...fieldsIn] = pos;
  if (!ref || !fieldsIn.length) throw usage('confirm takes <ref> and one or more field names', 'intervous confirm ecb-tin phase applied_on');
  const fields = [...new Set(fieldsIn.flatMap((f) => f.split(',')).map((f) => f.trim()).filter(Boolean))];
  /** @type {string[]} */ const warnings = [];
  const job = await resolveJob(ctx, ref);
  const present = fields.filter((f) => (job.uncertain ?? []).includes(f));
  for (const f of fields) if (!present.includes(f)) warnings.push(`"${f}" was not unconfirmed`);
  let remaining = job.uncertain ?? [];
  let event = null;
  if (present.length) {
    const after = await updateJob(ctx, job.id, { uncertain: withoutFields(job.uncertain, present) });
    remaining = after.uncertain;
    const { on } = await eventDate(ctx, {}, warnings);
    ({ event } = await insertEvent(ctx, job, { kind: 'note', occurred_on: on, title: `Confirmed: ${present.join(', ')}`, body: flags.note ?? null }));
  }
  const data = { id: job.id, slug: job.slug, company: job.company_name, confirmed: present, uncertain: remaining, event_id: event?.id ?? null, url: jobUrl(ctx, job), warnings };
  emitWrite(ctx, data, (d) => {
    console.log(d.confirmed.length ? `Confirmed for ${d.company}: ${d.confirmed.join(', ')}` : `Nothing to confirm for ${d.company}.`);
    console.log(d.uncertain.length ? `  still unconfirmed: ${d.uncertain.join(', ')}` : '  nothing left unconfirmed');
  });
}
