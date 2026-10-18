// Unit tests for the history import rules (no network, no personal data: every input is synthetic).
//   node --test cli/import
// The end-to-end run against a local stack lives outside the repo, because it uses the real
// history file (spec 7.1).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { prepareApplication } from '../lib/manifest.mjs';
import { deriveAdoption } from './adopt.mjs';
import { pendingChanges } from './compare.mjs';
import { decodeEntities, postingMarkdown } from './jd.mjs';
import {
  buildManifest, channelOf, charLimitOf, eventKindOf, eventsOf, loadMaps, metItem, phaseOf, placeOf, renameUncertain, splitGaps, splitParen,
} from './rules.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'intervous-import-test-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const put = (rel, data) => {
  const p = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  return p;
};

describe('small rules', () => {
  test('location -> country and work mode', () => {
    assert.deepEqual(placeOf('San Francisco, US', null), { country_code: 'US', work_mode: null });
    assert.deepEqual(placeOf('London, UK', 'onsite'), { country_code: 'GB', work_mode: 'onsite' });
    assert.deepEqual(placeOf('Milan, Italy', 'hybrid'), { country_code: 'IT', work_mode: 'hybrid' });
    assert.deepEqual(placeOf('Amsterdam, Netherlands', null), { country_code: 'NL', work_mode: null });
    assert.deepEqual(placeOf('Remote, Europe (Frankfurt listed)', 'remote'), { country_code: null, work_mode: 'remote' });
    assert.deepEqual(placeOf('Remote (GMT+2 to GMT-8)', null), { country_code: null, work_mode: 'remote' });
    assert.match(placeOf('Atlantis', null).warning, /no country/);
  });

  test('channel text -> channel + detail', () => {
    assert.deepEqual(channelOf('company ATS (Ashby)'), { channel: 'ats', channel_detail: 'Ashby' });
    assert.deepEqual(channelOf('company ATS (Ashby, found via LinkedIn)'), { channel: 'ats', channel_detail: 'Ashby, found via LinkedIn' });
    assert.deepEqual(channelOf('ECB portal'), { channel: 'portal', channel_detail: 'ECB portal' });
    assert.deepEqual(channelOf('recruiter'), { channel: 'recruiter', channel_detail: null });
    assert.deepEqual(channelOf('internal referral'), { channel: 'referral', channel_detail: 'internal referral' });
    assert.deepEqual(channelOf('LinkedIn'), { channel: 'linkedin', channel_detail: null });
    assert.deepEqual(channelOf('LinkedIn (applied on Meta careers site)'), { channel: 'linkedin', channel_detail: 'Meta careers' });
    assert.equal(channelOf('carrier pigeon').channel, 'other');
  });

  test('status, uncertain names, parentheses, met items', () => {
    assert.equal(phaseOf('not_applied'), 'skipped');
    assert.equal(phaseOf('interviewing'), 'interviewing');
    assert.throws(() => phaseOf('maybe'), /unknown history status/);
    assert.deepEqual(renameUncertain(['status', 'date_applied', 'date_cv_built', 'status']), ['phase', 'applied_on', 'cv_built_on']);
    assert.deepEqual(splitParen('EBA parser (302 cases, $0.96/doc; lab)'), { name: 'EBA parser', paren: '302 cases, $0.96/doc; lab' });
    assert.deepEqual(splitParen('A (b) with c'), { name: 'A (b) with c', paren: null });
    assert.deepEqual(metItem('agent behaviours (tool A, tool B)'), { requirement: 'agent behaviours', verdict: 'met', evidence: 'tool A, tool B' });
    assert.deepEqual(metItem('preferred: CS degree (two M.S.)'), { requirement: 'CS degree', verdict: 'met', importance: 'nice', evidence: 'two M.S.' });
    assert.deepEqual(metItem('Python'), { requirement: 'Python', verdict: 'met' });
  });

  test('gaps split on ";" and "NOT claimed: a, b" gives one gap per technology', () => {
    assert.deepEqual(splitGaps(['NOT claimed: Kafka, ClickHouse, CUDA programming.', 'Asks 5+ years; German is basic']), [
      { requirement: 'Kafka', fromNotClaimedList: true },
      { requirement: 'ClickHouse', fromNotClaimedList: true },
      { requirement: 'CUDA programming', fromNotClaimedList: true },
      { requirement: 'Asks 5+ years' },
      { requirement: 'German is basic' },
    ]);
  });

  test('char limits from the question', () => {
    assert.equal(charLimitOf('Motivation (1200 chars, 3 paragraphs)'), 1200);
    assert.equal(charLimitOf('Motivation (max ~1,195-1,200 chars)'), 1200);
    assert.equal(charLimitOf('Why us? (200-400 words)'), null);
  });

  test('event text rules, in spec order, with the "not applied" guard', () => {
    assert.equal(eventKindOf('Interview invitation (Webex)'), 'interview_scheduled');
    assert.equal(eventKindOf('Posting API returns 404'), 'posting_closed');
    assert.equal(eventKindOf('Campaign closing date'), 'closes');
    assert.equal(eventKindOf('Application submitted'), 'applied');
    assert.equal(eventKindOf('Applied'), 'applied');
    assert.equal(eventKindOf('Not applied'), 'note');
    assert.equal(eventKindOf('CV variant built and reviewed'), 'cv_built');
    assert.equal(eventKindOf('Submission attempted'), 'attempt');
    assert.equal(eventKindOf('Recruiter outreach'), 'note');
  });

  test('events: split, closing date, synthetic cv_built / applied, unsure dates', () => {
    const rec = { events: [
      { date: '2026-09-30', event: 'Answers written; submission attempted' },
      { date: '2026-10-08', event: 'Campaign closing date' },
    ] };
    const r = eventsOf(rec, { cvBuiltOn: '2026-09-29', appliedOn: '2026-09-30', uncertain: new Set(['applied_on']) });
    assert.equal(r.closesOn, '2026-10-08');
    assert.deepEqual([...r.addUncertain], ['phase']);
    assert.deepEqual(r.events, [
      { kind: 'cv_built', on: '2026-09-29', title: 'CV variant built' },
      { kind: 'note', on: '2026-09-30', title: 'Answers written' },
      { kind: 'note', on: '2026-09-30', title: 'Submission attempted' },
      { kind: 'applied', on: '2026-09-30', title: 'Sent', date_uncertain: true },
    ]);
    // an explicit applied event on the sent date is not doubled
    const r2 = eventsOf({ events: [{ date: '2026-08-30', event: 'CV variant built; applied' }] }, { cvBuiltOn: '2026-08-30', appliedOn: '2026-08-30', uncertain: new Set() });
    assert.deepEqual(r2.events.map((e) => e.kind), ['cv_built', 'applied']);
  });
});

describe('JD snapshots', () => {
  test('Greenhouse content is entity-escaped HTML; Ashby boards and the Apple API are found by the id in the URL', () => {
    assert.equal(decodeEntities('&lt;p&gt;Tom&#39;s &amp; co&lt;/p&gt;'), "<p>Tom's & co</p>");
    const gh = postingMarkdown({ id: 42, title: 'Engineer ', location: { name: 'Milan, Italy' }, content: '&lt;h2&gt;About&lt;/h2&gt;&lt;p&gt;Build &lt;strong&gt;agents&lt;/strong&gt;.&lt;/p&gt;' }, 'https://boards.example/jobs/42');
    assert.equal(gh.markdown, '# Engineer\n\nMilan, Italy\n\n## About\n\nBuild **agents**.\n');
    assert.equal(postingMarkdown({ id: 42, title: 'x', content: '' }, 'https://boards.example/jobs/43'), null);
    const ashby = postingMarkdown({ jobs: [{ id: 'aaa', title: 'Other', descriptionHtml: '' }, { id: 'b-1', title: 'FDE', location: 'Paris', descriptionHtml: '<ul><li>one</li><li>two</li></ul>' }] }, 'https://jobs.example/co/b-1');
    assert.equal(ashby.markdown, '# FDE\n\nParis\n\n-   one\n-   two\n');
    const apple = postingMarkdown({ res: { jobNumber: '100-1', postingTitle: 'ML Engineer', description: 'Do things.  ', minimumQualifications: 'Python\nEvals' } }, 'https://jobs.example/details/100-1/');
    assert.equal(apple.markdown, '# ML Engineer\n\n## Description\n\nDo things.\n\n## Minimum Qualifications\n\n- Python\n- Evals\n');
  });
});

describe('buildManifest with maps', () => {
  const dir = path.join(tmp, 'maps');
  put('maps/adopt.json', { adopt: { 'acme-fde': 7, 'beta-ml': null }, leave_alone: [1] });
  put('maps/proof_aliases.json', {
    proof_points: { parser: { name: 'Parser', facts: { exact_match: '70%' }, metric_status: 'needs_care' }, tool: { name: 'Tool' }, gen: { name: 'Generator' } },
    aliases: { 'doc pipeline eval': 'parser', parser: 'parser', 'parser as a classifier': { key: 'parser', prefix: 'classifier' }, tool: 'tool', 'tool + generator': ['tool', 'gen'] },
  });
  put('maps/gap_topics.json', {
    topics: [{ topic: 'years_experience', patterns: ['\\byears?\\b', 'senior'] }, { topic: 'kubernetes', patterns: ['kubernetes'] }],
    gap_states: [{ gap_state: 'not_claimed', patterns: ['not claimed'] }],
  });
  put('maps/overrides.json', {
    applications: {
      'acme-fde': {
        salary: { min: 1, max: 2, currency: 'EUR', period: 'month' },
        set: { uncertain: [], next_action: { text: 'Ask', due: null } },
        append: { status_evidence: 'Confirmed.' },
        gap_states: { kubernetes: { gap_state: 'no_longer_true', note: 'uses it daily' } },
        cautions: [{ requirement: 'Say lab', evidence: 'lab only' }],
        proof_point_details: { parser: 'answer: 99% strict' },
        keep_live_company: true,
      },
    },
    jd_snapshots: { 'acme-fde': { file: 'fetched/acme.json', captured_at: '2026-10-17T13:31:34Z', label: 'captured after applying' } },
  });
  put('maps/fetched/acme.json', { id: 555, title: 'FDE', content: '&lt;p&gt;Hi&lt;/p&gt;' });
  const pdf = put('pdf/cv.pdf', '%PDF-1.4\n%%EOF\n');
  put('variants/acme-v.tex', '\\documentclass{article}\n');
  put('answers/why.md', 'Because.\n');

  const rec = {
    id: 'acme-fde', company: 'Acme', role: 'FDE', team: null, location: 'Berlin, Germany', work_mode: null,
    url: 'https://boards.example/jobs/555', channel: 'company ATS (Greenhouse)', date_cv_built: '2026-08-30', date_applied: '2026-08-30',
    status: 'applied', status_evidence: 'Said so.', cv_variant: 'acme-v', cv_pdf_path: pdf, role_family: 'forward_deployed_customer_facing',
    seniority_asked: 'Senior', years_required: 5, visa_needed: false, salary: 'EUR 1-2 per month',
    requirements_matched: ['Python', 'evals (doc pipeline eval)'],
    gaps: ['5+ years asked; Kubernetes', 'NOT claimed: Spark'],
    proof_points_used: ['doc pipeline eval (300+ cases, 93%)', 'parser as a classifier (precision 80%)', 'tool + generator'],
    answers: [{ question: 'Why? (500 chars)', where: path.join(tmp, 'answers/why.md') }, { question: 'Cover letter', where: 'given in chat 2026-10-01' }],
    contacts: [{ name: 'Recruiter R', role: 'Recruiter' }],
    events: [{ date: '2026-08-30', event: 'CV variant built; applied' }],
    posting_check: { date: '2026-10-17', live: true },
    notes: 'n', uncertain: ['date_applied'],
  };

  test('maps load and the record maps onto a valid payload', () => {
    const maps = loadMaps(path.join(dir, 'adopt.json'));
    assert.deepEqual([...maps.adopt.entries()], [['acme-fde', 7], ['beta-ml', null]]);
    assert.equal(maps.cvRoot, tmp);
    const { manifest, warnings } = buildManifest(rec, maps, { jobId: 7, liveCompany: 'ACME GmbH', timeZone: 'Europe/Berlin' });
    assert.match(warnings.join('\n'), /kept as the live name "ACME GmbH"/);
    const prep = prepareApplication(manifest, { baseDir: maps.dir, today: '2026-10-18', fillAppliedOn: false });
    const p = prep.payload;
    assert.equal(p.job_id, 7);
    assert.equal(p.company, 'ACME GmbH');
    assert.equal(p.source, 'import');
    assert.deepEqual([p.country_code, p.channel, p.channel_detail, p.role_family], ['DE', 'ats', 'Greenhouse', 'forward_deployed']);
    assert.deepEqual(p.salary, { text: 'EUR 1-2 per month', min: 1, max: 2, currency: 'EUR', period: 'month' });
    assert.deepEqual(p.posting, { live: true, checked_at: '2026-10-17T12:00:00Z' });
    assert.deepEqual(p.uncertain, []); // the override confirms the date ...
    assert.equal(p.events.find((e) => e.kind === 'applied').date_uncertain, undefined); // ... so the event date is sure too
    assert.equal(p.status_evidence, 'Said so. Confirmed.');
    assert.deepEqual(p.next_action, { text: 'Ask', due: null });
    assert.deepEqual(p.requirements.map((r) => [r.verdict, r.requirement, r.topic ?? null, r.gap_state ?? null]), [
      ['met', 'Python', null, null],
      ['met', 'evals', null, null],
      ['gap', '5+ years asked', 'years_experience', null],
      ['gap', 'Kubernetes', 'kubernetes', 'no_longer_true'],
      ['gap', 'Spark', 'other', 'not_claimed'],
      ['caution', 'Say lab', null, null],
    ]);
    assert.deepEqual(p.proof_points.map((x) => [x.key, x.detail]), [['parser', 'answer: 99% strict'], ['tool', null], ['gen', null]]);
    assert.equal(p.proof_points[0].metric_status, 'needs_care');
    assert.deepEqual(p.answers.map((a) => [a.question, a.answer, a.char_limit ?? null, a.source_path]), [
      ['Why? (500 chars)', 'Because.', 500, path.join(tmp, 'answers/why.md')],
      ['Cover letter', null, null, 'given in chat 2026-10-01'],
    ]);
    assert.deepEqual(prep.uploads.map((u) => [u.kind, u.submitted, u.label]), [
      ['cv_pdf', null, `Rebuilt ${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(fs.statSync(pdf).mtime)}; may differ from what you sent`],
      ['cv_source', undefined, undefined],
    ]);
    assert.deepEqual(p.documents.map((d) => [d.kind, d.label, d.source_url, d.content]), [['jd_snapshot', 'captured after applying', rec.url, '# FDE\n\nHi\n']]);
  });

  test('a proof point with no alias stops the import', () => {
    const maps = loadMaps(path.join(dir, 'adopt.json'));
    assert.throws(() => buildManifest({ ...rec, proof_points_used: ['mystery project'] }, maps), /no alias: "mystery project"/);
  });
});

describe('adoption table', () => {
  const recs = [
    { id: 'a-one', company: 'A', role: 'R1', url: 'https://x.example/1?src=li' },
    { id: 'b-two', company: 'B', role: 'R2', url: null },
    { id: 'c-new', company: 'C', role: 'R3', url: 'https://x.example/3' },
  ];
  const rows = [
    { id: 1, slug: null, company_name: 'Legacy', role: 'Old', url: 'https://x.example/0' },
    { id: 10, slug: null, company_name: 'A', role: 'R1', url: 'https://x.example/1/' },
    { id: 11, slug: null, company_name: 'b', role: 'r2 ', url: '' },
  ];
  const maps = (adopt) => ({ adopt: new Map(Object.entries(adopt)), leaveAlone: [1] });

  test('agrees: by URL, by company + role, and a new row', () => {
    const r = deriveAdoption(recs, rows, maps({ 'a-one': 10, 'b-two': 11, 'c-new': null }));
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.table.map((t) => [t.slug, t.id, t.action, t.by]), [['a-one', 10, 'adopt', 'url'], ['b-two', 11, 'adopt', 'company_role'], ['c-new', null, 'create', null]]);
  });

  test('a re-run finds the rows by slug', () => {
    const done = [...rows.map((r) => ({ ...r, slug: r.id === 10 ? 'a-one' : r.id === 11 ? 'b-two' : null })), { id: 12, slug: 'c-new', company_name: 'C', role: 'R3', url: 'https://x.example/3' }];
    const r = deriveAdoption(recs, done, maps({ 'a-one': 10, 'b-two': 11, 'c-new': null }));
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.table.map((t) => [t.id, t.action]), [[10, 'update'], [11, 'update'], [12, 'update']]);
  });

  test('disagreements are refused', () => {
    assert.match(deriveAdoption(recs, rows, maps({ 'a-one': 11, 'b-two': 10, 'c-new': null })).errors.join('\n'), /adopt.json says #11, the live rows say #10/);
    assert.match(deriveAdoption(recs, rows, maps({ 'a-one': 10, 'b-two': 11 })).errors.join('\n'), /c-new: missing from adopt.json/);
    assert.match(deriveAdoption(recs, rows, maps({ 'a-one': 10, 'b-two': 11, 'c-new': 99 })).errors.join('\n'), /#99, which is not one of your rows/);
    assert.match(deriveAdoption(recs, rows, maps({ 'a-one': 10, 'b-two': 1, 'c-new': null })).errors.join('\n'), /leave_alone/);
    assert.match(deriveAdoption(recs, rows, maps({ 'a-one': null, 'b-two': 11, 'c-new': null })).errors.join('\n'), /says create, but live row #10 matches it by url/);
  });

  test('an explicit id that cannot be re-derived is a warning, not a refusal', () => {
    const r = deriveAdoption(recs, rows.map((x) => (x.id === 11 ? { ...x, role: 'Renamed' } : x)), maps({ 'a-one': 10, 'b-two': 11, 'c-new': null }));
    assert.deepEqual(r.errors, []);
    assert.match(r.warnings.join('\n'), /b-two: #11 could not be re-derived/);
  });
});

describe('no-change check mirrors the RPC', () => {
  const job = {
    id: 5, slug: 's', company_name: 'Acme', company_id: 'c1', role: 'R', location: '', url: '', phase: 'applied', source: 'import',
    applied_on: '2026-08-30', uncertain: [], salary_text: null, salary_min: null, salary_max: null, salary_currency: null, salary_period: null,
  };
  const stored = {
    job,
    requirements: [{ requirement: 'K8s', verdict: 'gap', topic: 'kubernetes', gap_state: 'worded_around', importance: null, evidence: null, anchor_text: null, note: null }],
    answers: [{ question: 'Q', answer: 'typed on the web', char_limit: null, submitted: true, source_path: 'chat' }],
    jpp: [{ detail: '93%', proof_point: { key: 'p' } }],
    contacts: [{ name: 'Kyle', role: 'Recruiter', email: null, linkedin_url: null, notes: null, company_id: 'c1' }],
    events: [{ kind: 'applied', occurred_on: '2026-08-30', title: 'Sent' }],
    documents: [{ kind: 'cv_pdf', sha256: 'abc', label: 'L', submitted: null, storage_path: 'u/s/cv_pdf/abc-cv.pdf' }],
  };
  const env = { company: { id: 'c1', name: 'Acme' }, proofPoints: new Map([['p', { key: 'p', name: 'P', summary: null, metric: null, facts: { a: 1 }, metric_status: 'verified', caveat: null, link: null }]]) };
  const payload = {
    slug: 's', company: 'acme', role: 'R', location: null, url: null, phase: 'applied', applied_on: '2026-08-30', uncertain: [], source: 'import',
    requirements: [{ requirement: 'K8s', verdict: 'gap', topic: 'kubernetes' }], // gap_state left out: the stored one is kept
    answers: [{ question: 'Q', answer: null, source_path: 'chat' }], // text left out: the stored one is kept
    proof_points: [{ key: 'p', detail: '93%', name: 'P', facts: { a: 1 } }],
    contacts: [{ name: 'Kyle', role: 'Recruiter' }],
    events: [{ kind: 'applied', on: '2026-08-30', title: 'Sent' }],
    documents: [{ kind: 'cv_pdf', sha256: 'abc', label: 'L', submitted: null }],
  };

  test('nothing to do', () => assert.deepEqual(pendingChanges(stored, payload, env), []));
  test('each kind of change is seen', () => {
    assert.deepEqual(pendingChanges(stored, { ...payload, phase: 'draft' }, env), ['phase']);
    assert.deepEqual(pendingChanges(stored, { ...payload, requirements: [{ ...payload.requirements[0], gap_state: 'no_longer_true' }] }, env), ['requirements']);
    assert.deepEqual(pendingChanges(stored, { ...payload, proof_points: [{ ...payload.proof_points[0], facts: { b: 2 } }] }, env), ['proof point p']);
    assert.deepEqual(pendingChanges(stored, { ...payload, events: [...payload.events, { kind: 'note', on: '2026-09-01', title: 'x' }] }, env), ['1 new event']);
    assert.deepEqual(pendingChanges(stored, { ...payload, documents: [{ kind: 'cv_pdf', sha256: 'abc', label: 'new label' }] }, env), ['cv_pdf label']);
    assert.deepEqual(pendingChanges(null, payload, env), ['new application']);
  });
});
