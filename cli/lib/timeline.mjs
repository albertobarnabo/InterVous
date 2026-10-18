// Timeline writes shared by sent / log / move / confirm / feedback.
// Events go through the job_events triggers, so the phase moves exactly as it does for the web:
// an event infers to_phase from its kind and the phase moves unless a newer phase-bearing event exists.
import { EVENT_KINDS, toDateOnly } from '../../lib/core/index.mjs';
import { jobUrl, loadSettings, resolveJob, todayFor } from './jobs.mjs';
import { invalid, must, usage } from './output.mjs';
import { checkDate, checkKind, checkPhase, checkTimestamp } from './validate.mjs';

/** Friendly names people type for event kinds. */
export const KIND_ALIASES = Object.freeze({
  interview: 'interview_scheduled', invite: 'interview_scheduled', invited: 'interview_scheduled',
  interviewed: 'interview_done', reject: 'rejection', rejected: 'rejection',
  followup: 'follow_up_sent', follow_up: 'follow_up_sent', 'follow-up': 'follow_up_sent',
  ack: 'auto_ack', built: 'cv_built', closed: 'posting_closed',
});

export function normalizeKind(kind) {
  const k = String(kind ?? '').trim().toLowerCase();
  const resolved = KIND_ALIASES[k] ?? k;
  if (resolved === 'phase_change') throw usage('Use `intervous move <ref> <phase>` to change the phase directly.');
  if (!EVENT_KINDS.includes(resolved)) {
    throw usage(`Unknown event kind "${kind}"`, `Kinds: ${EVENT_KINDS.filter((x) => x !== 'phase_change').join(', ')}`);
  }
  return checkKind(resolved);
}

/** Remove `fields` from an uncertain list. */
export const withoutFields = (list, fields) => (list ?? []).filter((f) => !fields.includes(f));

/** Update one jobs row; an update that touches 0 rows is an error. */
export async function updateJob(ctx, id, patch) {
  const rows = must(await ctx.sb.from('jobs').update(patch).eq('id', id).select('*'), 'update the application');
  if (!rows?.length) throw invalid(`The update of application #${id} changed nothing (is it yours?)`);
  return rows[0];
}

export async function reloadJob(ctx, id) {
  return must(await ctx.sb.from('jobs').select('*').eq('id', id).single(), 'reload the application');
}

/**
 * Insert an event unless the same kind + date + title is already logged.
 * @returns {Promise<{ event: any, duplicate: boolean }>}
 */
export async function insertEvent(ctx, job, ev) {
  const sb = ctx.sb;
  // a direct phase change is always meant (move checks "already in that phase" itself)
  if (ev.kind !== 'phase_change') {
    let q = sb.from('job_events').select('*').eq('job_id', job.id).eq('kind', ev.kind).eq('occurred_on', ev.occurred_on);
    q = ev.title ? q.eq('title', ev.title) : q.or('title.is.null,title.eq.');
    const same = must(await q.limit(1), 'check the timeline');
    if (same?.length) return { event: same[0], duplicate: true };
  }
  const row = { job_id: job.id, source: 'cli', ...ev };
  const event = must(await sb.from('job_events').insert(row).select('*').single(), 'log the event');
  return { event, duplicate: false };
}

/** Events dated after `on` that carry a phase (the trigger lets the newest one decide the phase). */
async function newerPhaseEvents(ctx, jobId, on, exceptId) {
  const rows = must(await ctx.sb.from('job_events').select('id, kind, occurred_on, to_phase').eq('job_id', jobId).not('to_phase', 'is', null)
    .gt('occurred_on', on).order('occurred_on', { ascending: false }).limit(20), 'check the timeline');
  return rows.filter((r) => r.id !== exceptId);
}

/**
 * After an event with a to_phase: make sure the phase followed. The trigger keeps the phase of the
 * newest phase-bearing event, so a scheduled interview dated next week would block "rejected"
 * today. A past newer event is real history (warn); future-dated ones only mean "scheduled", so
 * the phase is set directly, and the automatic phase_change that edit logs is removed again
 * (this event already records the change).
 */
async function settlePhase(ctx, job, event, today, warnings) {
  let after = await reloadJob(ctx, job.id);
  if (!event.to_phase || after.phase === event.to_phase) return after;
  const newer = await newerPhaseEvents(ctx, job.id, event.occurred_on, event.id);
  const past = newer.filter((e) => e.occurred_on <= today);
  if (past.length) {
    warnings.push(`the phase stays ${after.phase}: a newer event (${past[0].kind}, ${past[0].occurred_on}) decides it. Use a later --on to override.`);
    return after;
  }
  if (!newer.length) {
    warnings.push(`the phase is still ${after.phase}`);
    return after;
  }
  const blocked = after.phase;
  await updateJob(ctx, job.id, { phase: event.to_phase });
  const auto = must(await ctx.sb.from('job_events').select('id').eq('job_id', job.id).eq('kind', 'phase_change').eq('source', 'auto')
    .eq('to_phase', event.to_phase).gt('id', event.id).order('id', { ascending: false }).limit(1), 'check the timeline');
  if (auto.length) must(await ctx.sb.from('job_events').delete().eq('id', auto[0].id).select('id'), 'tidy the timeline');
  warnings.push(`set to ${event.to_phase} directly: ${newer.map((e) => `${e.kind.replace(/_/g, ' ')} on ${e.occurred_on}`).join(', ')} (still ahead) had kept it at ${blocked}`);
  after = await reloadJob(ctx, job.id);
  return after;
}

/** Resolve --contact NAME among the application's contacts; add the contact when it is new. */
export async function resolveContact(ctx, job, name) {
  const n = String(name).trim();
  if (!n) return { contact: null, created: false };
  const all = must(await ctx.sb.from('contacts').select('*').eq('job_id', job.id), 'load contacts');
  const exact = all.find((c) => c.name.toLowerCase() === n.toLowerCase());
  if (exact) return { contact: exact, created: false };
  const prefix = all.filter((c) => c.name.toLowerCase().startsWith(n.toLowerCase()));
  if (prefix.length === 1) return { contact: prefix[0], created: false };
  const contact = must(await ctx.sb.from('contacts').insert({ job_id: job.id, company_id: job.company_id ?? null, name: n }).select('*').single(), 'add the contact');
  return { contact, created: true };
}

/** --on DATE, else the date of --at in the user's time zone, else today. */
export async function eventDate(ctx, flags, warnings) {
  const today = await todayFor(ctx);
  if (flags.at) checkTimestamp(flags.at, '--at');
  if (flags.on) {
    checkDate(flags.on, '--on');
    if (flags.at) {
      const tz = (ctx._settings ?? (await loadSettings(ctx))).timezone;
      const atDay = toDateOnly(flags.at, tz);
      if (atDay !== flags.on) warnings.push(`--on ${flags.on} and --at ${flags.at} (${atDay}) are different days; the event is dated ${flags.on}`);
    }
    return { on: flags.on, today, assumed: false };
  }
  if (flags.at) {
    const tz = (ctx._settings ?? (await loadSettings(ctx))).timezone;
    return { on: /** @type {string} */ (toDateOnly(flags.at, tz)), today, assumed: false };
  }
  return { on: today, today, assumed: true };
}

/**
 * Log an event (intervous log, feedback).
 * @param {any} ctx
 * @param {string} ref
 * @param {string} kindInput
 * @param {{ on?: string, at?: string, title?: string, body?: string, contact?: string }} flags
 */
export async function logEvent(ctx, ref, kindInput, flags) {
  const kind = normalizeKind(kindInput);
  /** @type {string[]} */ const warnings = [];
  const job = await resolveJob(ctx, ref);
  const { on, today } = await eventDate(ctx, flags, warnings);
  if (on > today && !['interview_scheduled'].includes(kind)) warnings.push(`${on} is in the future`);
  let contact = null;
  if (flags.contact) {
    const r = await resolveContact(ctx, job, flags.contact);
    contact = r.contact;
    if (r.created) warnings.push(`added ${contact.name} as a new contact for this application`);
  }
  if (kind === 'applied') warnings.push('`intervous sent` also marks the CV that was sent and clears the unconfirmed sent date; prefer it for "applied"');
  const ev = { kind, occurred_on: on, occurred_at: flags.at ?? null, title: flags.title ?? null, body: flags.body ?? null, contact_id: contact?.id ?? null };
  const { event, duplicate } = await insertEvent(ctx, job, ev);
  if (duplicate) warnings.push(`already logged: ${kind} on ${on}${ev.title ? ` "${ev.title}"` : ''}; nothing added`);
  const after = duplicate ? await reloadJob(ctx, job.id) : await settlePhase(ctx, job, event, today, warnings);
  return {
    id: job.id, slug: job.slug, company: job.company_name, role: job.role,
    event: { id: event.id, kind: event.kind, occurred_on: event.occurred_on, occurred_at: event.occurred_at, title: event.title, body: event.body, direction: event.direction, contact: contact?.name ?? null },
    duplicate, phase_before: job.phase, phase: after.phase, moved: after.phase !== job.phase,
    url: jobUrl(ctx, job), warnings,
  };
}

/**
 * Move the phase directly (intervous move, feedback no_response): inserts kind=phase_change, to_phase=<phase>.
 * @param {any} ctx
 * @param {string} ref
 * @param {string} phaseInput
 * @param {{ on?: string, note?: string }} flags
 */
export async function movePhase(ctx, ref, phaseInput, flags) {
  const phase = checkPhase(String(phaseInput ?? '').trim().toLowerCase(), 'phase');
  /** @type {string[]} */ const warnings = [];
  const job = await resolveJob(ctx, ref);
  const { on, today } = await eventDate(ctx, { on: flags.on }, warnings);
  if (on > today) warnings.push(`${on} is in the future`);
  if (job.phase === phase && !flags.note) {
    return { id: job.id, slug: job.slug, company: job.company_name, role: job.role, from: job.phase, phase, moved: false, event: null, url: jobUrl(ctx, job), warnings: [`already ${phase}; nothing changed`] };
  }
  if (!['draft', 'skipped'].includes(phase) && !job.applied_on) {
    await updateJob(ctx, job.id, { applied_on: on });
    warnings.push(`there was no sent date; applied_on set to ${on}. Fix it with \`intervous sent ${job.slug ?? job.id} --on YYYY-MM-DD\` if it was sent earlier.`);
  }
  const { event } = await insertEvent(ctx, job, { kind: 'phase_change', to_phase: phase, occurred_on: on, body: flags.note ?? null });
  let after = await settlePhase(ctx, job, event, today, warnings);
  if (after.phase === phase && after.uncertain?.includes('phase')) {
    after = await updateJob(ctx, job.id, { uncertain: withoutFields(after.uncertain, ['phase']) });
  }
  return {
    id: job.id, slug: job.slug, company: job.company_name, role: job.role, from: job.phase, phase: after.phase, moved: after.phase !== job.phase,
    event: { id: event.id, kind: event.kind, occurred_on: event.occurred_on, to_phase: event.to_phase, body: event.body },
    url: jobUrl(ctx, job), warnings,
  };
}

