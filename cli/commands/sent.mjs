// intervous sent <ref> [--on DATE] [--cv PDF]
// Records that the application went out: an `applied` event (which moves a draft to applied), the
// sent date, and the CV that was sent: the newest cv_pdf, or --cv (uploaded) when the PDF changed
// since. Clears "phase" and "applied_on" from the unconfirmed fields.
import { mimeFor, objectPath, readLocalFile, resolvePath, uploadObject } from '../lib/files.mjs';
import { jobUrl, resolveJob } from '../lib/jobs.mjs';
import { emitWrite, must, usage } from '../lib/output.mjs';
import { eventDate, insertEvent, reloadJob, updateJob, withoutFields } from '../lib/timeline.mjs';

export const options = {
  on: { type: 'string' },
  cv: { type: 'string' },
};

export async function run(ctx, pos, flags) {
  if (pos.length !== 1) throw usage('sent takes one <ref>', 'intervous sent <ref> [--on YYYY-MM-DD] [--cv path/to/sent.pdf]');
  /** @type {string[]} */ const warnings = [];
  const job = await resolveJob(ctx, pos[0]);
  const { on, today, assumed } = await eventDate(ctx, { on: flags.on }, warnings);
  if (assumed) warnings.push(`no --on given: recorded as sent today (${today})`);
  if (on > today) warnings.push(`${on} is in the future`);
  const sb = ctx.sb;

  // 1. the CV that was sent (before the event, so a bad --cv path changes nothing)
  let cv = null;
  if (flags.cv) {
    const f = readLocalFile(resolvePath(flags.cv), '--cv');
    const mime = mimeFor('cv_pdf', f.path);
    const uid = await ctx.uid();
    const name = objectPath(uid, job.slug ?? `job-${job.id}`, 'cv_pdf', f.sha256, f.path);
    const status = await uploadObject(sb, name, f.buf, mime);
    const doc = must(await sb.from('job_documents').upsert({
      job_id: job.id, kind: 'cv_pdf', storage_path: name, mime_type: mime, size_bytes: f.size, sha256: f.sha256, submitted: true, label: `Sent ${on}`,
    }, { onConflict: 'job_id,kind,sha256' }).select('id, storage_path').single(), 'attach the CV');
    cv = { status, path: doc.storage_path, document_id: doc.id, submitted: true };
  } else {
    const newest = must(await sb.from('job_documents').select('id, storage_path, submitted').eq('job_id', job.id).eq('kind', 'cv_pdf')
      .order('created_at', { ascending: false }).limit(1), 'load the CV');
    if (newest?.length) {
      must(await sb.from('job_documents').update({ submitted: true }).eq('id', newest[0].id).select('id'), 'mark the CV as sent');
      cv = { status: 'marked_sent', path: newest[0].storage_path, document_id: newest[0].id, submitted: true };
    } else {
      warnings.push('no CV on file for this application; pass --cv <the exact PDF you sent> to keep it');
    }
  }

  // 2. the event (moves draft/skipped -> applied through the trigger)
  const { duplicate } = await insertEvent(ctx, job, { kind: 'applied', occurred_on: on });

  // 3. the sent date is what he said; the unconfirmed sent facts are now confirmed
  const current = await reloadJob(ctx, job.id);
  if (job.applied_on && job.applied_on !== on) warnings.push(`applied_on changed from ${job.applied_on} to ${on}`);
  /** @type {Record<string, any>} */
  const patch = { applied_on: on, uncertain: withoutFields(current.uncertain, ['phase', 'applied_on']) };
  if (['draft', 'skipped'].includes(current.phase)) {
    // a newer phase-bearing event kept it unsent; he says it went out, so set it directly
    patch.phase = 'applied';
    warnings.push(`a newer event kept the phase at ${current.phase}; set it to applied directly`);
  }
  const after = await updateJob(ctx, job.id, patch);

  const data = {
    id: job.id, slug: job.slug, company: job.company_name, role: job.role,
    phase_before: job.phase, phase: after.phase, applied_on: after.applied_on, event_logged: !duplicate,
    cv, url: jobUrl(ctx, job), warnings,
  };
  emitWrite(ctx, data, (d) => {
    console.log(`Sent: ${d.company} · ${d.role} on ${d.applied_on} (${d.phase_before} → ${d.phase})`);
    if (d.cv) console.log(`  CV marked as the sent version: ${d.cv.path}${d.cv.status === 'uploaded' ? ' (uploaded)' : ''}`);
    console.log(d.url);
  });
}
