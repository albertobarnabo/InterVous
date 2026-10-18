// End-to-end tests of the CLI against a LOCAL Supabase stack (cli/test/stack.mjs: Postgres with
// supabase/tests/setup.sql + the v2 migration, PostgREST, GoTrue, storage-api). Every CLI run gets
// its own INTERVOUS_CONFIG_DIR and HOME, so ~/.config/intervous and the live project are never used.
//
//   node --test "cli/test/**/*.test.mjs"            starts a stack, runs, removes it
//   node cli/test/stack.mjs up   (then the tests)   reuses a kept stack; `down` removes it
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { dockerAvailable, startStack } from './stack.mjs';
import { CLI, put, readSession, sandbox, signIn, signedInSandbox, tempDir, tinyPdf, writeSession } from './helpers.mjs';

const docker = dockerAvailable();
const IMPORT_BUILT = fs.existsSync(path.join(path.dirname(CLI), 'commands', 'import.mjs'));

/** The manifest from spec 6.3, with real local files next to it. */
function writeApp(dir, slug, extra = {}) {
  const appDir = path.join(dir, 'applications', slug);
  put(dir, `pdf/Alberto_Barnabo_Resume_${slug}.pdf`, tinyPdf(slug));
  put(dir, `variants/${slug}.tex`, `\\documentclass{article}\\begin{document}${slug}\\end{document}\n`);
  put(appDir, 'jd.md', '# AI Forward Deployed Engineer\n\nBuild **production LLM systems** with customers.\n\n- Spark / Databricks platform\n');
  put(appDir, 'answers/why.md', 'Because the data already lives in the lakehouse.\n');
  const manifest = {
    slug,
    company: 'Databricks', company_website: 'https://www.databricks.com',
    role: 'AI Forward Deployed Engineer', team: null,
    location: 'Amsterdam, NL', country_code: 'NL', work_mode: 'hybrid',
    url: `https://job-boards.greenhouse.io/databricks/jobs/${slug.length}00${slug.charCodeAt(0)}`,
    channel: 'ats', channel_detail: 'Greenhouse',
    role_family: 'forward_deployed', seniority: 'extensive years in customer-facing roles', years_required: 3,
    visa_needed: false,
    salary: { text: null, min: null, max: null, currency: null, period: null },
    posting: { live: true, checked_at: '2026-10-17T12:00:00Z' },
    phase: 'draft', cv_built_on: '2026-10-17', applied_on: null, closes_on: null,
    cv_variant: slug,
    next_action: { text: 'Send by 24 Oct', due: '2026-10-24' },
    notes: 'test notes', status_evidence: null, uncertain: ['phase', 'applied_on', 'channel'],
    files: { cv_pdf: `../../pdf/Alberto_Barnabo_Resume_${slug}.pdf`, cv_source: path.join(dir, `variants/${slug}.tex`), jd_md: 'jd.md' },
    requirements: [
      { requirement: 'Production LLM systems with customers', verdict: 'met', importance: 'required', evidence: 'ECB FM360 agent', anchor_text: 'production LLM systems' },
      { requirement: 'Spark / Databricks platform', verdict: 'gap', topic: 'spark', gap_state: 'not_claimed', anchor_text: 'Spark / Databricks platform' },
      { requirement: "Say 'lab', not 'production', for the EBA parser", verdict: 'caution', evidence: 'Lab EKS only; strict exact-match 73.8%' },
    ],
    proof_points: [{ key: 'ecb-eba-parser', detail: '302 cases, $0.96/doc, lab deployment' }],
    answers: [{ question: 'Why Databricks?', file: 'answers/why.md', char_limit: 1200 }],
    contacts: [{ name: 'Jane Recruiter', role: 'Recruiter' }],
    events: [{ kind: 'cv_built', on: '2026-10-17', title: 'CV variant built and reviewed' }],
    ...extra,
  };
  const file = put(appDir, 'intervous.json', JSON.stringify(manifest, null, 2));
  return { file, manifest, appDir };
}

describe('intervous CLI against a local stack', { skip: !docker && 'docker is not available' }, () => {
  /** @type {Awaited<ReturnType<typeof startStack>>} */ let stack;
  /** @type {Awaited<ReturnType<typeof signedInSandbox>>} */ let me;
  let work;
  const SLUG = 'databricks-ai-fde-amsterdam';
  const q = (sql) => stack.sql(sql).trim();
  const counts = (uid) => q(`select concat_ws(',',
      (select count(*) from public.jobs where user_id = '${uid}'),
      (select count(*) from public.job_events where user_id = '${uid}'),
      (select count(*) from public.job_documents where user_id = '${uid}'),
      (select count(*) from public.job_requirements where user_id = '${uid}'),
      (select count(*) from public.job_answers where user_id = '${uid}'),
      (select count(*) from public.contacts where user_id = '${uid}'),
      (select count(*) from public.proof_points where user_id = '${uid}'),
      (select count(*) from storage.objects where name like '${uid}/%'))`);

  before(async () => {
    stack = await startStack();
    me = await signedInSandbox(stack, 'alberto');
    work = tempDir('intervous-cli-work-');
  });
  after(async () => {
    me?.cleanup();
    if (work) fs.rmSync(work, { recursive: true, force: true });
    await stack?.stop();
  });

  test('login refuses without a terminal (exit 2)', async () => {
    const r = await me.run(['login', '--email', 'a@b.c'], { input: 'secret\n' });
    assert.equal(r.code, 2);
    assert.equal(r.error.message, 'Run this yourself in a terminal.');
  });

  test('signed out: exit 2 with the login hint', async () => {
    const box = sandbox(stack);
    try {
      const r = await box.run(['whoami']);
      assert.equal(r.code, 2);
      assert.equal(r.error.code, 'not_logged_in');
      assert.match(r.error.hint, /intervous login/);
    } finally {
      box.cleanup();
    }
  });

  test('doctor is green and writes nothing', async () => {
    const before = counts(me.user.id);
    const r = await me.run(['doctor', '--orphans']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.ok, true);
    assert.deepEqual(r.json.checks.map((c) => c.id), ['config', 'session', 'migration', 'storage', 'orphans']);
    assert.match(r.json.checks.find((c) => c.id === 'migration').detail, /22023/);
    assert.equal(counts(me.user.id), before);
  });

  test('add --dry-run resolves everything and writes nothing', async () => {
    const { file } = writeApp(work, SLUG);
    const before = counts(me.user.id);
    const r = await me.run(['add', file, '--dry-run']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.ok, true);
    const d = r.json.data;
    assert.equal(d.action, 'would_create');
    // companies is a global table: on a reused stack Databricks may already exist
    const known = q("select count(*) from public.companies where lower(name) = 'databricks'") !== '0';
    assert.equal(d.company.status, known ? 'linked' : 'would_create');
    assert.deepEqual(d.documents.map((x) => [x.kind, x.status]), [['cv_pdf', 'would_upload'], ['cv_source', 'would_upload'], ['jd_snapshot', 'would_store']]);
    assert.ok(d.changes.some((c) => c.field === 'role' && c.to === 'AI Forward Deployed Engineer'));
    assert.equal(d.lists.requirements.to, 3);
    assert.equal(counts(me.user.id), before);
  });

  test('add creates the whole application in one call', async () => {
    const { file } = writeApp(work, SLUG);
    const r = await me.run(['add', file]);
    assert.equal(r.code, 0, r.stderr);
    const d = r.json.data;
    assert.equal(d.slug, SLUG);
    assert.equal(d.created, true);
    assert.equal(d.phase, 'draft');
    assert.equal(d.company, 'Databricks');
    assert.equal(d.url, `https://example.test/intervous/applications/${SLUG}`);
    const pdf = d.documents.find((x) => x.kind === 'cv_pdf');
    assert.equal(pdf.status, 'uploaded');
    assert.match(pdf.path, new RegExp(`^${me.user.id}/${SLUG}/cv_pdf/[0-9a-f]{12}-Alberto_Barnabo_Resume_${SLUG}\\.pdf$`));
    assert.equal(d.documents.find((x) => x.kind === 'jd_snapshot').status, 'stored');
    assert.equal(q(`select string_agg(kind || ':' || coalesce(mime_type, ''), ',' order by kind) from public.job_documents where job_id = ${d.id}`),
      'cv_pdf:application/pdf,cv_source:application/x-tex,jd_snapshot:text/markdown');
    assert.equal(q(`select answer from public.job_answers where job_id = ${d.id}`), 'Because the data already lives in the lakehouse.');
    assert.equal(q(`select count(*) from public.job_requirements where job_id = ${d.id}`), '3');
    assert.equal(q(`select source || ',' || phase || ',' || coalesce(status, '') from public.jobs where id = ${d.id}`), 'cli,draft,Not Applied');
    assert.equal(q(`select count(*) from storage.objects where name like '${me.user.id}/${SLUG}/%'`), '2');
  });

  test('add is idempotent: a re-run changes nothing', async () => {
    const before = counts(me.user.id);
    const { file } = writeApp(work, SLUG);
    const r = await me.run(['add', file]);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.data.created, false);
    assert.deepEqual(r.json.data.documents.map((x) => x.status), ['unchanged', 'unchanged', 'unchanged']);
    assert.equal(counts(me.user.id), before);
  });

  test('add --dry-run on a stored application prints a field-level diff', async () => {
    const { file, manifest } = writeApp(work, SLUG);
    manifest.role = 'Senior AI Forward Deployed Engineer';
    manifest.requirements.push({ requirement: 'Kubernetes', verdict: 'gap', topic: 'kubernetes' });
    fs.writeFileSync(file, JSON.stringify(manifest));
    const r = await me.run(['add', file, '--dry-run']);
    assert.equal(r.code, 0, r.stderr);
    const d = r.json.data;
    assert.equal(d.action, 'would_update');
    assert.equal(d.match, 'slug');
    assert.deepEqual(d.changes, [{ field: 'role', from: 'AI Forward Deployed Engineer', to: 'Senior AI Forward Deployed Engineer' }]);
    assert.deepEqual(d.lists.requirements.added, ['kubernetes']);
    assert.deepEqual(d.lists.events, { existing: 1, new: [] });
    writeApp(work, SLUG); // restore
  });

  test('find matches by normalised URL and by company, with % escaped', async () => {
    const { manifest } = writeApp(work, SLUG);
    let r = await me.run(['find', '--url', `${manifest.url}/?utm_source=x`]);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.json.map((x) => x.slug), [SLUG]);
    r = await me.run(['find', '--company', 'datab', '--role', 'forward']);
    assert.deepEqual(r.json.map((x) => x.slug), [SLUG]);
    r = await me.run(['find', '--company', 'D%']);
    assert.deepEqual(r.json, []);
  });

  test('sent: applied event, sent date, newest CV marked sent, sent facts confirmed', async () => {
    const r = await me.run(['sent', 'databricks', '--on', '2026-10-17']);
    assert.equal(r.code, 0, r.stderr);
    const d = r.json.data;
    assert.equal(d.phase_before, 'draft');
    assert.equal(d.phase, 'applied');
    assert.equal(d.applied_on, '2026-10-17');
    assert.equal(d.cv.status, 'marked_sent');
    assert.equal(q(`select submitted from public.job_documents where job_id = ${d.id} and kind = 'cv_pdf'`), 't');
    assert.equal(q(`select array_to_string(uncertain, ',') || '|' || application_date from public.jobs where id = ${d.id}`), 'channel|2026-10-17');
    assert.equal(q(`select count(*) from public.job_events where job_id = ${d.id} and kind = 'applied' and occurred_on = '2026-10-17'`), '1');
  });

  test('sent --cv uploads the exact PDF that went out', async () => {
    const pdf = put(work, 'sent-version.pdf', tinyPdf('the version that was sent'));
    const r = await me.run(['sent', SLUG, '--on', '2026-10-17', '--cv', pdf]);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.data.cv.status, 'uploaded');
    assert.equal(r.json.data.event_logged, false);
    assert.equal(q(`select count(*) from public.job_documents where job_id = ${r.json.data.id} and kind = 'cv_pdf' and submitted`), '2');
  });

  test('log moves the phase through the trigger; a scheduled interview does not block a later outcome', async () => {
    let r = await me.run(['log', SLUG, 'reply', '--on', '2026-10-18', '--title', 'Recruiter wrote back', '--contact', 'jane']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.data.phase, 'screening');
    assert.equal(r.json.data.event.contact, 'Jane Recruiter');
    r = await me.run(['log', SLUG, 'interview', '--at', '2099-01-05T14:00:00+01:00']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.data.event.kind, 'interview_scheduled');
    assert.equal(r.json.data.event.occurred_on, '2099-01-05');
    assert.equal(r.json.data.phase, 'interviewing');
    r = await me.run(['log', SLUG, 'reply', '--on', '2026-10-18', '--title', 'Recruiter wrote back']);
    assert.equal(r.json.data.duplicate, true);

    r = await me.run(['move', SLUG, 'rejected', '--note', 'after the first round']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.data.from, 'interviewing');
    assert.equal(r.json.data.phase, 'rejected');
    const id = r.json.data.id;
    assert.equal(q(`select count(*) from public.job_events where job_id = ${id} and kind = 'phase_change' and to_phase = 'rejected' and source = 'cli' and body = 'after the first round'`), '1');
    assert.equal(q(`select count(*) from public.job_events where job_id = ${id} and source = 'auto'`), '0');
    assert.equal(q(`select phase || ',' || status from public.jobs where id = ${id}`), 'rejected,Inactive');
  });

  test('feedback still works and maps onto log / move', async () => {
    const { file } = writeApp(work, 'acme-ml-engineer', { company: 'Acme', role: 'ML Engineer', phase: 'applied', applied_on: '2026-09-01', proof_points: [] });
    assert.equal((await me.run(['add', file])).code, 0);
    let r = await me.run(['feedback', 'acme', 'interview', '--stage', 'Technical Interview', '--date', '2026-09-20']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.data.mapped_to, 'log interview_scheduled');
    assert.equal(r.json.data.event.title, 'Technical Interview');
    assert.equal(r.json.data.phase, 'interviewing');
    r = await me.run(['feedback', 'acme', 'no_response']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.data.phase, 'no_reply');
    r = await me.run(['feedback', 'acme', 'maybe']);
    assert.equal(r.code, 1);
  });

  test('show returns the dossier with working signed URLs', async () => {
    const r = await me.run(['show', SLUG]);
    assert.equal(r.code, 0, r.stderr);
    const d = r.json;
    assert.equal(d.job.slug, SLUG);
    assert.ok(d.events.length >= 4);
    assert.equal(d.requirements.length, 3);
    assert.equal(d.proof_points[0].key, 'ecb-eba-parser');
    assert.equal(d.proof_points[0].detail, '302 cases, $0.96/doc, lab deployment');
    assert.equal(d.checks.cautions.length, 1);
    assert.equal(typeof d.now, 'string');
    const pdf = d.documents.find((x) => x.kind === 'cv_pdf' && x.signed_url);
    const res = await fetch(pdf.signed_url);
    assert.equal(res.status, 200);
    assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString(), '%PDF-');
    assert.match(d.documents.find((x) => x.kind === 'jd_snapshot').content, /production LLM systems/);
  });

  test('list, today and insights read the same rows as the web', async () => {
    let r = await me.run(['list', '--json']);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(Array.isArray(r.json));
    assert.equal(r.json.length, 2);
    assert.ok(r.json.every((x) => typeof x.now === 'string' && x.group));
    r = await me.run(['list', '--phase', 'rejected']);
    assert.deepEqual(r.json.map((x) => x.slug), [SLUG]);
    r = await me.run(['list', '--group', 'closed']);
    assert.equal(r.json.length, 2);
    r = await me.run(['list', '--phase', 'sent']);
    assert.equal(r.code, 1);

    r = await me.run(['today']);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.json.heading, /^Today · /);
    assert.ok(Array.isArray(r.json.items));
    assert.ok(Array.isArray(r.json.actions));

    r = await me.run(['insights', '--only', 'actions', '--json']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(Object.keys(r.json).sort(), ['actions', 'generated_on']);
    r = await me.run(['insights']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.insights.length, 10);
    for (const s of r.json.insights) assert.ok(['counts', 'range', 'percent'].includes(s.allowed_display));
    assert.equal(r.json.insights.find((s) => s.id === 'i2').allowed_display, 'counts');
  });

  test('next, confirm, answer, attach, jd, proof and open', async () => {
    let r = await me.run(['next', SLUG, 'Ask what came of the first round', '--due', '2026-10-25']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.data.next_action_due, '2026-10-25');
    r = await me.run(['confirm', SLUG, 'channel', 'phase']);
    assert.deepEqual(r.json.data.confirmed, ['channel']);
    assert.deepEqual(r.json.data.uncertain, []);
    assert.equal(q(`select count(*) from public.job_events where job_id = ${r.json.data.id} and kind = 'note' and title = 'Confirmed: channel'`), '1');

    const ans = put(work, 'answers/extra.md', 'Happy to relocate.\n');
    r = await me.run(['answer', SLUG, '--question', 'why databricks?', '--text', 'Short.', '--limit', '3']);
    assert.equal(r.json.data.answer.status, 'updated');
    assert.match(r.json.data.warnings[0], /over the 3 limit/);
    r = await me.run(['answer', SLUG, '--question', 'Anything else?', '--file', ans, '--submitted']);
    assert.equal(r.json.data.answer.status, 'added');

    const cover = put(work, 'cover.md', 'Dear team,\n');
    r = await me.run(['attach', SLUG, cover, '--kind', 'cover_letter', '--submitted']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.data.document.status, 'uploaded');
    r = await me.run(['attach', SLUG, put(work, 'cv.docx', 'x'), '--kind', 'other']);
    assert.equal(r.code, 1);

    const jd = put(work, 'jd2.md', '# The JD, captured again\n');
    r = await me.run(['jd', SLUG, jd, '--captured-at', '2026-10-18T09:00:00Z']);
    assert.equal(r.json.data.document.status, 'stored');
    r = await me.run(['jd', SLUG, jd]);
    assert.equal(r.json.data.document.status, 'unchanged');

    r = await me.run(['proof', 'set', 'ecb-eba-parser', '--name', 'ECB EBA parser', '--status', 'needs_care', '--fact', 'cases=302', '--fact', 'exact_match=73.8%']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.json.data.facts, { cases: 302, exact_match: '73.8%' });
    r = await me.run(['proof', 'list']);
    assert.equal(r.json.find((p) => p.key === 'ecb-eba-parser').uses, 1);

    r = await me.run(['open', 'datab']);
    assert.equal(r.json.url, `https://example.test/intervous/applications/${SLUG}`);
  });

  test('refs: ambiguous prefix exit 4, unknown exit 3, invalid input exit 1', async () => {
    const { file } = writeApp(work, 'acme-data-engineer', { company: 'Acme', role: 'Data Engineer', proof_points: [] });
    assert.equal((await me.run(['add', file])).code, 0);
    let r = await me.run(['show', 'acme']);
    assert.equal(r.code, 4);
    assert.equal(r.error.code, 'conflict');
    r = await me.run(['show', 'nothing-like-this']);
    assert.equal(r.code, 3);
    r = await me.run(['move', 'acme-data', 'sent']);
    assert.equal(r.code, 1);
    r = await me.run(['log', 'acme-data', 'reply', '--on', '18/10/2026']);
    assert.equal(r.code, 1);

    const bad = writeApp(work, 'bad-manifest', { requirements: [{ requirement: 'x', verdict: 'maybe', topic: 'Not Snake' }], cv_built_on: '2026-13-01' });
    r = await me.run(['add', bad.file]);
    assert.equal(r.code, 1);
    assert.equal(r.error.details.errors.length, 3);
  });

  test('another user cannot see these applications (RLS)', async () => {
    const other = await signedInSandbox(stack, 'other');
    try {
      const r = await other.run(['show', SLUG]);
      assert.equal(r.code, 3);
      assert.deepEqual((await other.run(['list'])).json, []);
    } finally {
      other.cleanup();
    }
  });

  test('legacy jobs add writes phase; the trigger keeps status in step', async () => {
    const r = await me.run(['jobs', 'add', '--company', 'Legacy Co', '--role', 'Engineer', '--date', '2026-09-02']);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.phase, 'applied');
    assert.equal(r.json.status, 'Active');
    assert.equal(r.json.applied_on, '2026-09-02');
  });

  test('add adopts a slug-less row by URL or by job_id', async () => {
    let r = await me.run(['jobs', 'add', '--company', 'Adopt Co', '--role', 'Applied AI', '--url', 'https://jobs.lever.co/adopt/77f6?lever-source=li', '--date', '2026-09-03']);
    assert.equal(r.code, 0, r.stderr);
    const legacyId = r.json.id;
    const byUrl = writeApp(work, 'adopt-co-applied-ai', { company: 'Adopt Co', role: 'Applied AI', url: 'https://jobs.lever.co/adopt/77f6/', phase: 'applied', applied_on: '2026-09-03', proof_points: [], events: [] });
    r = await me.run(['add', byUrl.file, '--dry-run']);
    assert.equal(r.json.data.action, 'would_update');
    assert.equal(r.json.data.match, 'url');
    assert.equal(r.json.data.id, legacyId);
    r = await me.run(['add', byUrl.file]);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual([r.json.data.id, r.json.data.adopted, r.json.data.created], [legacyId, true, false]);

    r = await me.run(['jobs', 'add', '--company', 'NoUrl Co', '--role', 'Engineer', '--phase', 'draft']);
    const noUrlId = r.json.id;
    const byId = writeApp(work, 'nourl-co-engineer', { company: 'NoUrl Co', role: 'Engineer', url: '', job_id: noUrlId, proof_points: [], events: [] });
    r = await me.run(['add', byId.file, '--dry-run']);
    assert.equal(r.json.data.match, 'job_id');
    r = await me.run(['add', byId.file]);
    assert.deepEqual([r.json.data.id, r.json.data.adopted], [noUrlId, true]);
    const taken = writeApp(work, 'another-slug', { company: 'NoUrl Co', role: 'Engineer', url: '', job_id: noUrlId, proof_points: [], events: [] });
    r = await me.run(['add', taken.file]);
    assert.equal(r.code, 4);
  });

  test('a sent phase without applied_on gets today, with a warning', async () => {
    const { file } = writeApp(work, 'sent-no-date', { company: 'Dateless', role: 'Engineer', phase: 'applied', applied_on: null, proof_points: [], events: [] });
    const r = await me.run(['add', file]);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.json.data.warnings.join('\n'), /applied_on is empty: set applied_on to today/);
    assert.equal(q(`select applied_on is not null from public.jobs where id = ${r.json.data.id}`), 't');
  });

  test('import is a stub until WP4 builds it', { skip: IMPORT_BUILT && 'cli/commands/import.mjs exists' }, async () => {
    const r = await me.run(['import', 'history.json', '--map', 'adopt.json']);
    assert.equal(r.code, 1);
    assert.equal(r.error.code, 'not_implemented');
  });

  test('doctor --orphans lists a stored file no application refers to', async () => {
    const st = await signIn(stack, me.email, me.password);
    const res = await fetch(`${stack.url}/storage/v1/object/intervous-docs/${me.user.id}/stray/cv_pdf/000000000000-x.pdf`, {
      method: 'POST', headers: { apikey: stack.anonKey, Authorization: `Bearer ${st.access_token}`, 'content-type': 'application/pdf' }, body: tinyPdf('stray'),
    });
    assert.equal(res.status, 200, await res.text());
    const r = await me.run(['doctor', '--orphans']);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.json.orphans.map((o) => o.name), [`${me.user.id}/stray/cv_pdf/000000000000-x.pdf`]);
  });

  test('refresh lock: parallel commands on an expired session all succeed, and the token rotates once', async () => {
    const box = await signedInSandbox(stack, 'refresh');
    try {
      const s = readSession(box.configDir);
      writeSession(box.configDir, { ...s, expires_at: Math.floor(Date.now() / 1000) - 60 });
      const runs = await Promise.all(Array.from({ length: 4 }, () => box.run(['whoami'])));
      for (const r of runs) assert.equal(r.code, 0, r.stderr);
      const after = readSession(box.configDir);
      assert.notEqual(after.refresh_token, s.refresh_token);
      assert.ok(after.expires_at > Date.now() / 1000);
      assert.equal(fs.statSync(path.join(box.configDir, 'session.json')).mode & 0o777, 0o600);
      assert.equal(fs.statSync(box.configDir).mode & 0o777, 0o700);
      assert.equal(fs.existsSync(path.join(box.configDir, 'session.lock')), false);
      assert.deepEqual(fs.readdirSync(box.configDir).sort(), ['session.json']);
    } finally {
      box.cleanup();
    }
  });

  test('refresh lock: a refresh waits for the lock, then re-reads the session another process saved', async () => {
    const box = await signedInSandbox(stack, 'lock');
    const lock = path.join(box.configDir, 'session.lock');
    try {
      const s0 = readSession(box.configDir);
      writeSession(box.configDir, { ...s0, expires_at: Math.floor(Date.now() / 1000) - 60 });
      fs.writeFileSync(lock, `999999 ${Date.now()} othertoken\n`); // another intervous holds the lock
      let settled = false;
      const pending = box.run(['whoami']).then((r) => ((settled = true), r));
      await new Promise((r) => setTimeout(r, 600));
      assert.equal(settled, false, 'whoami must wait while the lock is held');
      // meanwhile the other process refreshes and saves the new session
      const sb = createClient(stack.url, stack.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await sb.auth.refreshSession({ refresh_token: s0.refresh_token });
      assert.equal(error, null);
      writeSession(box.configDir, data.session);
      await new Promise((r) => setTimeout(r, 1100)); // a refresh by whoami would now mint a different token
      fs.rmSync(lock);
      const r = await pending;
      assert.equal(r.code, 0, r.stderr);
      assert.equal(readSession(box.configDir).access_token, data.session.access_token, 'whoami used the saved session instead of refreshing again');
    } finally {
      box.cleanup();
    }
  });

  test('a session saved by the old CLI keeps working and moves to the new key', async () => {
    const box = await signedInSandbox(stack, 'legacy');
    try {
      const s = readSession(box.configDir);
      writeSession(box.configDir, { ...s, expires_at: Math.floor(Date.now() / 1000) - 60 }, 'sb-127-auth-token');
      const r = await box.run(['whoami']);
      assert.equal(r.code, 0, r.stderr);
      const all = JSON.parse(fs.readFileSync(path.join(box.configDir, 'session.json'), 'utf8'));
      assert.deepEqual(Object.keys(all), ['intervous-cli']);
    } finally {
      box.cleanup();
    }
  });

  test('a missing migration exits 6, a dead server exits 5', async () => {
    // a gateway whose REST side has no v2 schema; auth still goes to the real GoTrue
    const server = http.createServer(async (req, res) => {
      if (req.url.startsWith('/auth/v1')) {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const up = await fetch(`${stack.url}${req.url}`, { method: req.method, headers: { ...req.headers, host: undefined }, body: chunks.length ? Buffer.concat(chunks) : undefined });
        res.writeHead(up.status, { 'content-type': up.headers.get('content-type') ?? 'application/json' });
        return res.end(Buffer.from(await up.arrayBuffer()));
      }
      const rpc = req.url.includes('/rpc/');
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify(rpc
        ? { code: 'PGRST202', message: 'Could not find the function public.iv_upsert_application(p) in the schema cache', details: null, hint: null }
        : { code: 'PGRST205', message: "Could not find the table 'public.job_overview' in the schema cache", details: null, hint: null }));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    try {
      const url = `http://127.0.0.1:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`;
      let r = await me.run(['list'], { env: { INTERVOUS_URL: url } });
      assert.equal(r.code, 6, r.stderr);
      assert.equal(r.error.code, 'schema_missing');
      assert.match(r.error.hint, /v2 migration/);
      r = await me.run(['doctor'], { env: { INTERVOUS_URL: url } });
      assert.equal(r.code, 6);
      const migration = r.json.checks.find((c) => c.id === 'migration');
      assert.equal(migration.level, 'fail');
      assert.match(migration.detail, /parts of the v2 schema are missing: job_overview, job_events/);
      assert.match(migration.detail, /iv_upsert_application/);
    } finally {
      await new Promise((r) => server.close(r));
    }
    const r = await me.run(['list'], { env: { INTERVOUS_URL: 'http://127.0.0.1:9' } });
    assert.equal(r.code, 5);
    assert.equal(r.error.code, 'network');
  });
});
