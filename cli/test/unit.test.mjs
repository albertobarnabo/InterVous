// Offline tests for cli/lib: validation, the manifest, files, the refresh lock, errors, config.
// Run: node --test "cli/test/**/*.test.mjs"
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileStorage } from '../lib/auth.mjs';
import { legacyStorageKey, readConfig } from '../lib/config.mjs';
import { mimeFor, objectPath, safeBasename, sha256 } from '../lib/files.mjs';
import { acquireFileLock, withFileLock } from '../lib/lock.mjs';
import { diffJob, prepareApplication } from '../lib/manifest.mjs';
import { CliError, EXIT, fromSupabase } from '../lib/output.mjs';
import { parseFacts, validatePayload } from '../lib/validate.mjs';
import { put, tempDir, tinyPdf } from './helpers.mjs';

const TODAY = '2026-10-18';
const base = () => ({ slug: 'acme-ml-engineer', company: 'Acme', role: 'ML Engineer', phase: 'draft' });

describe('validatePayload', () => {
  test('accepts the spec manifest shape and normalises codes', () => {
    const { payload, warnings } = validatePayload({
      ...base(), country_code: 'nl', salary: { text: '€80K', min: 80000, max: 90000, currency: 'eur', period: 'year' },
      requirements: [{ requirement: 'Spark', verdict: 'gap', topic: 'spark', gap_state: 'not_claimed' }],
      events: [{ kind: 'cv_built', on: '2026-10-17' }],
    }, { today: TODAY, requireCompanyRole: true });
    assert.equal(payload.country_code, 'NL');
    assert.equal(payload.salary.currency, 'EUR');
    assert.deepEqual(warnings, []);
  });

  test('a sent phase without applied_on gets today, and says so', () => {
    const { payload, warnings } = validatePayload({ ...base(), phase: 'applied' }, { today: TODAY });
    assert.equal(payload.applied_on, TODAY);
    assert.match(warnings.join('\n'), /applied_on is empty: set applied_on to today \(2026-10-18\)/);
  });

  test('collects every problem in one error', () => {
    try {
      validatePayload({
        slug: 'Bad Slug', company: 'Acme', role: 'x', phase: 'sent', applied_on: '2026-02-30', channel: 'twitter',
        requirements: [{ requirement: 'x', verdict: 'maybe', topic: 'Not Snake' }],
        events: [{ kind: 'applied' }],
      }, { today: TODAY, requireCompanyRole: true });
      assert.fail('should throw');
    } catch (e) {
      assert.ok(e instanceof CliError);
      assert.equal(e.exit, EXIT.USAGE);
      const errors = /** @type {any} */ (e.details).errors.join('\n');
      for (const bit of ['slug must match', 'phase must be one of', 'applied_on must be YYYY-MM-DD', 'channel must be one of', 'verdict must be one of', 'topic must be lowercase snake_case', 'events[0].on is required']) {
        assert.match(errors, new RegExp(bit.replace(/[[\]().]/g, '\\$&')));
      }
    }
  });

  test('company and role are required for a manifest', () => {
    assert.throws(() => validatePayload({ slug: 'acme-x' }, { today: TODAY, requireCompanyRole: true }), /company is required/);
  });

  test('warns about unknown keys and answers over the limit', () => {
    const { warnings } = validatePayload({ ...base(), colour: 'teal', answers: [{ question: 'Why?', answer: 'x'.repeat(12), char_limit: 10 }] }, { today: TODAY });
    assert.match(warnings.join('\n'), /unknown key "colour"/);
    assert.match(warnings.join('\n'), /12 characters, over the 10 limit/);
  });
});

describe('prepareApplication', () => {
  let dir;
  before(() => {
    dir = tempDir();
    put(dir, 'pdf/cv final.pdf', tinyPdf());
    put(dir, 'cv.tex', '\\documentclass{article}');
    put(dir, 'app/jd.md', '# The JD\n');
    put(dir, 'app/answers/why.md', 'Because.\n\n');
  });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('resolves relative paths against the manifest folder and reads every file', () => {
    const baseDir = path.join(dir, 'app');
    const p = prepareApplication({
      ...base(), url: 'https://jobs.example.com/1',
      files: { cv_pdf: '../pdf/cv final.pdf', cv_source: { path: path.join(dir, 'cv.tex'), label: 'source' }, jd_md: 'jd.md' },
      answers: [{ question: 'Why Acme?', file: 'answers/why.md', char_limit: 100 }],
    }, { baseDir, today: TODAY });
    assert.equal(p.uploads.length, 2);
    const pdf = p.uploads.find((u) => u.kind === 'cv_pdf');
    assert.equal(pdf.mime, 'application/pdf');
    assert.equal(pdf.sha256, sha256(tinyPdf()));
    assert.equal(p.uploads.find((u) => u.kind === 'cv_source').mime, 'application/x-tex');
    assert.equal(p.inline.length, 1);
    assert.equal(p.inline[0].kind, 'jd_snapshot');
    assert.equal(p.inline[0].content, '# The JD\n');
    assert.equal(p.inline[0].source_url, 'https://jobs.example.com/1');
    assert.ok(p.inline[0].captured_at.startsWith('20'));
    assert.equal(p.payload.answers[0].answer, 'Because.');
    assert.equal(p.payload.answers[0].source_path, path.join(baseDir, 'answers/why.md'));
    assert.equal('file' in p.payload.answers[0], false);
    assert.equal('files' in p.payload, false);
  });

  test('refuses a missing file, an unknown file kind, a non-PDF cv_pdf, and answer + file together', () => {
    assert.throws(() => prepareApplication({ ...base(), files: { cv_pdf: 'nope.pdf' } }, { baseDir: dir, today: TODAY }), /files.cv_pdf: no such file/);
    assert.throws(() => prepareApplication({ ...base(), files: { photo: 'cv.tex' } }, { baseDir: dir, today: TODAY }), /not a known file kind/);
    assert.throws(() => prepareApplication({ ...base(), files: { cv_pdf: 'cv.tex' } }, { baseDir: dir, today: TODAY }), /must be a \.pdf/);
    assert.throws(() => prepareApplication({ ...base(), answers: [{ question: 'q', answer: 'a', file: 'cv.tex' }] }, { baseDir: dir, today: TODAY }), /both answer and file/);
  });
});

describe('files', () => {
  test('object names are <uid>/<slug>/<kind>/<sha12>-<basename>', () => {
    const sha = 'ab12cd34ef56'.padEnd(64, '0');
    assert.equal(objectPath('u1', 'acme-x', 'cv_pdf', sha, '/x/Alberto Barnabò CV (final).pdf'), 'u1/acme-x/cv_pdf/ab12cd34ef56-Alberto-Barnabo-CV-final-.pdf');
    assert.equal(safeBasename('/a/b/ok_name-1.tex'), 'ok_name-1.tex');
  });

  test('the bucket only takes what the migration allows', () => {
    assert.equal(mimeFor('cover_letter', 'c.md'), 'text/markdown');
    assert.throws(() => mimeFor('other', 'c.docx'), /does not accept \.docx/);
  });
});

describe('diffJob', () => {
  test('missing key keeps, present key overwrites, null role or phase keeps', () => {
    const job = { company_name: 'Acme', role: 'ML Engineer', phase: 'applied', location: 'Berlin', notes: 'old', salary_min: 1, uncertain: ['phase'] };
    const changes = diffJob(job, { slug: 's', role: '', phase: null, notes: 'new', uncertain: ['phase'], salary: { min: 2 } }, 'Acme');
    const fields = changes.map((c) => c.field);
    assert.deepEqual(fields.sort(), ['notes', 'salary_min'].sort());
  });
});

describe('errors map to the exit codes of spec 6.4', () => {
  const cases = [
    [{ code: 'PGRST202', message: 'Could not find the function' }, EXIT.SCHEMA],
    [{ code: 'PGRST205', message: 'Could not find the table' }, EXIT.SCHEMA],
    [{ code: '42P01', message: 'relation does not exist' }, EXIT.SCHEMA],
    [{ code: '42883', message: 'function does not exist' }, EXIT.SCHEMA],
    [{ code: 'PGRST301', message: 'JWT expired' }, EXIT.AUTH],
    [{ code: '23505', message: 'duplicate key' }, EXIT.CONFLICT],
    [{ code: 'P0002', message: 'job 9 not found' }, EXIT.NOT_FOUND],
    [{ code: '22023', message: 'slug is required' }, EXIT.USAGE],
    [{ code: '', message: 'TypeError: fetch failed' }, EXIT.SERVER],
  ];
  for (const [error, exit] of cases) {
    test(`${error.code || error.message} -> ${exit}`, () => assert.equal(fromSupabase(error).exit, exit));
  }
  test('raw debugging commands treat an unknown column as a typo', () => {
    assert.equal(fromSupabase({ code: '42703', message: 'column x does not exist' }, 'select', { schemaHint: false }).exit, EXIT.USAGE);
  });
});

describe('parseFacts', () => {
  test('numbers stay numbers, := parses JSON, k= removes', () => {
    assert.deepEqual(parseFacts(['cases=302', 'exact_match=73.8%', 'deployed=lab only', 'list:=[1,2]', 'old=']), {
      set: { cases: 302, exact_match: '73.8%', deployed: 'lab only', list: [1, 2] }, unset: ['old'],
    });
  });
});

describe('config', () => {
  test('env first, then config.json, then .env', () => {
    const dir = tempDir();
    const keep = { ...process.env };
    try {
      process.env.INTERVOUS_CONFIG_DIR = dir;
      delete process.env.INTERVOUS_URL;
      delete process.env.INTERVOUS_ANON_KEY;
      fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ url: 'https://file.supabase.co', anonKey: 'k-file', appUrl: 'https://app.example/intervous/' }));
      let c = readConfig();
      assert.equal(c.source, 'config.json');
      assert.equal(c.appUrl, 'https://app.example/intervous');
      process.env.INTERVOUS_URL = 'http://127.0.0.1:1';
      process.env.INTERVOUS_ANON_KEY = 'k-env';
      c = readConfig();
      assert.equal(c.source, 'env');
      assert.equal(c.url, 'http://127.0.0.1:1');
    } finally {
      process.env = keep;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a session saved by the pre-v2 CLI is read, then moved to the new key on write', () => {
    const dir = tempDir();
    const keep = process.env.INTERVOUS_CONFIG_DIR;
    try {
      process.env.INTERVOUS_CONFIG_DIR = dir;
      const legacy = legacyStorageKey('https://abcdefgh.supabase.co');
      assert.equal(legacy, 'sb-abcdefgh-auth-token');
      fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify({ [legacy]: '{"access_token":"old"}' }));
      const st = fileStorage(legacy);
      assert.equal(st.getItem('intervous-cli'), '{"access_token":"old"}');
      st.setItem('intervous-cli', '{"access_token":"new"}');
      const all = JSON.parse(fs.readFileSync(path.join(dir, 'session.json'), 'utf8'));
      assert.deepEqual(Object.keys(all), ['intervous-cli']);
      assert.equal(fs.statSync(path.join(dir, 'session.json')).mode & 0o777, 0o600);
      assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
      assert.equal(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')).length, 0);
    } finally {
      if (keep === undefined) delete process.env.INTERVOUS_CONFIG_DIR;
      else process.env.INTERVOUS_CONFIG_DIR = keep;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('refresh lock', () => {
  let dir;
  let file;
  before(() => {
    dir = tempDir();
    file = path.join(dir, 'session.lock');
  });
  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('holds the pid and a timestamp, and is removed on release', async () => {
    const release = await acquireFileLock({ file });
    const [pid, at] = fs.readFileSync(file, 'utf8').trim().split(/\s+/);
    assert.equal(Number(pid), process.pid);
    assert.ok(Math.abs(Date.now() - Number(at)) < 5000);
    release();
    assert.equal(fs.existsSync(file), false);
  });

  test('a second taker waits until the first lets go', async () => {
    const release = await acquireFileLock({ file });
    const t0 = Date.now();
    setTimeout(release, 200);
    const release2 = await acquireFileLock({ file, retryMs: 20 });
    assert.ok(Date.now() - t0 >= 180);
    release2();
  });

  test('a lock older than 30s is stale and gets broken', async () => {
    fs.writeFileSync(file, `999999 ${Date.now() - 31_000} deadbeef\n`);
    const release = await acquireFileLock({ file, timeoutMs: 500 });
    assert.match(fs.readFileSync(file, 'utf8'), new RegExp(`^${process.pid} `));
    release();
  });

  test('gives up after the timeout with exit 5', async () => {
    fs.writeFileSync(file, `999999 ${Date.now()} cafe\n`);
    await assert.rejects(acquireFileLock({ file, timeoutMs: 150, retryMs: 20 }), (e) => e instanceof CliError && e.exit === EXIT.SERVER && e.code === 'session_locked');
    fs.rmSync(file, { force: true });
  });

  test('serialises two processes', async () => {
    const script = `
      import { acquireFileLock } from ${JSON.stringify(new URL('../lib/lock.mjs', import.meta.url).href)};
      const release = await acquireFileLock({ file: ${JSON.stringify(file)} });
      process.stdout.write('held\\n');
      setTimeout(() => { release(); process.stdout.write('released\\n'); }, 400);
    `;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
    const closed = new Promise((resolve) => child.on('close', resolve));
    await new Promise((resolve) => child.stdout.once('data', resolve));
    const t0 = Date.now();
    const order = [];
    child.stdout.on('data', () => order.push('child released'));
    await withFileLock(async () => order.push('parent ran'), { file, retryMs: 20 });
    assert.ok(Date.now() - t0 >= 300, 'the parent waited for the child');
    await closed;
    assert.deepEqual(order, ['child released', 'parent ran']);
  });
});
