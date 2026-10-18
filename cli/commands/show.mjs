// intervous show <ref>
// Everything about one application: the job, its timeline, documents (signed URLs valid 10 min),
// answers, fit items, proof points (with the wording this company saw), contacts, and the
// "before the interview, check" list from lib/core.
import {
  GAP_STATE_LABELS, METRIC_STATUS_LABELS, beforeInterviewChecks, buildStepper, eventTitle, formatShort, nowSentence, phaseLabel, todayIn,
} from '../../lib/core/index.mjs';
import { BUCKET } from '../lib/config.mjs';
import { formatBytes } from '../lib/files.mjs';
import { jobUrl, loadSettings, resolveJob } from '../lib/jobs.mjs';
import { emitRead, must, usage, wrap } from '../lib/output.mjs';

export const options = {};

const SIGNED_URL_SECONDS = 600;

export async function run(ctx, pos) {
  if (pos.length !== 1) throw usage('show takes one <ref>', 'intervous show <slug|prefix|id> [--json]');
  const job = await resolveJob(ctx, pos[0]);
  const sb = ctx.sb;
  const id = job.id;
  const [overview, events, documents, answers, requirements, jpp, contacts, settings] = await Promise.all([
    sb.from('job_overview').select('*').eq('id', id).maybeSingle().then((r) => must(r, 'load the overview')),
    sb.from('job_events').select('*').eq('job_id', id).order('occurred_on').order('id').then((r) => must(r, 'load events')),
    sb.from('job_documents').select('*').eq('job_id', id).order('created_at', { ascending: false }).then((r) => must(r, 'load documents')),
    sb.from('job_answers').select('*').eq('job_id', id).order('position').then((r) => must(r, 'load answers')),
    sb.from('job_requirements').select('*').eq('job_id', id).order('position').then((r) => must(r, 'load fit items')),
    sb.from('job_proof_points').select('*, proof_point:proof_points(*)').eq('job_id', id).order('position').then((r) => must(r, 'load proof points')),
    sb.from('contacts').select('*').eq('job_id', id).order('created_at').then((r) => must(r, 'load contacts')),
    loadSettings(ctx),
  ]);
  const today = todayIn(settings.timezone);

  const stored = documents.filter((d) => d.storage_path);
  const signed = stored.length
    ? must(await sb.storage.from(BUCKET).createSignedUrls(stored.map((d) => d.storage_path), SIGNED_URL_SECONDS), 'sign document URLs')
    : [];
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.error ? null : s.signedUrl]));
  const docs = documents.map((d) => ({ ...d, signed_url: d.storage_path ? urlByPath.get(d.storage_path) ?? null : null }));

  const app = { ...job, ...(overview ?? {}) };
  const proofPoints = jpp.map((r) => r.proof_point).filter(Boolean);
  const input = {
    apps: [app], events, requirements, jobProofPoints: jpp.map((r) => ({ job_id: r.job_id, proof_point_id: r.proof_point_id, position: r.position, detail: r.detail })), proofPoints, contacts, settings, today,
  };
  const data = {
    job: app,
    now: nowSentence(app, { today, events, settings }),
    stepper: buildStepper(app, { today, events, settings }),
    checks: beforeInterviewChecks(input, id),
    events,
    documents: docs,
    answers,
    requirements,
    proof_points: jpp.map((r) => ({ key: r.proof_point?.key, name: r.proof_point?.name, detail: r.detail, metric_status: r.proof_point?.metric_status, caveat: r.proof_point?.caveat, facts: r.proof_point?.facts, position: r.position })),
    contacts,
    url: jobUrl(ctx, job),
    signed_urls_expire_in_s: SIGNED_URL_SECONDS,
  };
  emitRead(ctx, data, (d) => printDossier(d, today));
}

function printDossier(d, today) {
  const j = d.job;
  const f = (x) => (x ? formatShort(x, { today }) : '');
  console.log(`${j.company_name} · ${j.role}`);
  console.log(`#${j.id}${j.slug ? ` ${j.slug}` : ''} · ${phaseLabel(j.phase)}${j.location ? ` · ${j.location}` : ''}${j.work_mode ? ` · ${j.work_mode}` : ''}`);
  console.log(`Now: ${d.now}`);
  if (j.next_action) console.log(`Next: ${j.next_action}${j.next_action_due ? ` (due ${f(j.next_action_due)})` : ''}`);
  if (j.uncertain?.length) console.log(`Unconfirmed: ${j.uncertain.join(', ')}`);
  if (j.url) console.log(`Posting: ${j.url}`);
  console.log(`Dossier: ${d.url}`);

  const steps = d.stepper.steps.map((s) => `${s.reached ? '●' : '○'} ${s.label}${s.date ? ` ${f(s.date)}` : ''}`).join('  ');
  console.log(`\n${steps}`);

  if (d.checks.show || d.checks.cautions.length || d.checks.proofPoints.length) {
    console.log(`\n${d.checks.show ? 'Before the interview, check' : 'Claims to handle with care'}`);
    for (const c of d.checks.cautions) console.log(wrap(`${c.requirement}${c.evidence ? `: ${c.evidence}` : ''}`, 88, '  ! '));
    for (const p of d.checks.proofPoints) {
      console.log(wrap(`${p.name}: you wrote "${p.detail ?? ''}" (${METRIC_STATUS_LABELS[p.metricStatus] ?? p.metricStatus})${p.caveat ? `. ${p.caveat}` : ''}`, 88, '  ! '));
    }
  }

  console.log('\nTimeline');
  if (!d.events.length) console.log('  (nothing logged)');
  for (const e of d.events) {
    const extra = e.kind === 'phase_change' ? '' : e.to_phase ? ` → ${phaseLabel(e.to_phase)}` : '';
    console.log(`  ${f(e.occurred_on).padEnd(11)} ${eventTitle(e)}${extra}${e.date_uncertain ? ' (date unsure)' : ''}${e.body ? ` · ${e.body.split('\n')[0].slice(0, 70)}` : ''}`);
  }

  console.log('\nDocuments');
  if (!d.documents.length) console.log('  (none)');
  for (const doc of d.documents) {
    if (doc.kind === 'jd_snapshot') {
      console.log(`  jd_snapshot  ${(doc.content ?? '').length.toLocaleString('en')} characters${doc.captured_at ? `, captured ${f(doc.captured_at)}` : ''}${doc.label ? ` · ${doc.label}` : ''}`);
      continue;
    }
    const sent = doc.submitted === true ? 'sent version' : doc.submitted === false ? 'not the sent version' : 'sent version unknown';
    console.log(`  ${doc.kind.padEnd(12)} ${doc.storage_path?.split('/').pop()}  ${formatBytes(doc.size_bytes)} · ${sent}${doc.label ? ` · ${doc.label}` : ''}`);
    if (doc.signed_url) console.log(`               ${doc.signed_url}`);
  }

  if (d.requirements.length) {
    console.log('\nFit');
    for (const r of d.requirements) {
      const state = r.gap_state && r.verdict !== 'met' ? ` [${GAP_STATE_LABELS[r.gap_state] ?? r.gap_state}]` : '';
      console.log(wrap(`${r.requirement}${r.topic ? ` (${r.topic})` : ''}${state}${r.evidence ? ` — ${r.evidence}` : ''}`, 88, `  ${r.verdict.padEnd(8)} `));
    }
  }
  if (d.proof_points.length) {
    console.log('\nProof points (as worded here)');
    for (const p of d.proof_points) console.log(wrap(`${p.key}: ${p.detail ?? '(no wording saved)'}${p.metric_status && p.metric_status !== 'verified' ? ` [${METRIC_STATUS_LABELS[p.metric_status]}]` : ''}`, 88, '  '));
  }
  if (d.answers.length) {
    console.log('\nAnswers');
    for (const a of d.answers) {
      const len = a.answer ? `${a.answer.length}${a.char_limit ? `/${a.char_limit}` : ''} characters` : `not saved${a.source_path ? ` (${a.source_path})` : ''}`;
      console.log(`  ${a.question} · ${len}${a.submitted ? ' · submitted' : ''}`);
    }
  }
  if (d.contacts.length) {
    console.log('\nContacts');
    for (const c of d.contacts) console.log(`  ${c.name}${c.role ? `, ${c.role}` : ''}${c.email ? ` <${c.email}>` : ''}`);
  }
}
