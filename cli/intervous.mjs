#!/usr/bin/env node
// intervous — command-line access to InterVous as the signed-in user.
//
// Auth: `intervous login` asks for the password in the terminal (hidden input) and
// stores the Supabase session in ~/.config/intervous/session.json (mode 600). Every
// later command reuses that session; supabase-js refreshes the access token from the
// refresh token when it expires and the adapter below writes the new one back. All
// reads and writes go through the same row-level security as the web app.
//
// Run `intervous help` for the command list. Add --json to any read command for
// machine-readable output.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'intervous');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');
const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// config + session storage
// ---------------------------------------------------------------------------

function ensureDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writePrivate(file, obj) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), { mode: 0o600 });
  fs.chmodSync(file, 0o600);
}

// The URL and anon key are public (the browser bundle ships them). They are read
// from the app's .env once and cached, so the CLI also works outside the repo.
function loadConfig() {
  const cached = readJson(CONFIG_FILE, null);
  if (cached?.url && cached?.anonKey) return cached;
  const envPath = path.join(APP_DIR, '.env');
  let env = '';
  try {
    env = fs.readFileSync(envPath, 'utf8');
  } catch {
    fail(`No config in ${CONFIG_FILE} and no ${envPath} to read it from.`);
  }
  const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');
  const cfg = { url: get('NEXT_PUBLIC_SUPABASE_URL'), anonKey: get('NEXT_PUBLIC_SUPABASE_ANON_KEY') };
  if (!cfg.url || !cfg.anonKey) fail(`NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY missing from ${envPath}.`);
  writePrivate(CONFIG_FILE, cfg);
  return cfg;
}

const fileStorage = {
  getItem: (key) => readJson(SESSION_FILE, {})[key] ?? null,
  setItem: (key, value) => {
    const all = readJson(SESSION_FILE, {});
    all[key] = value;
    writePrivate(SESSION_FILE, all);
  },
  removeItem: (key) => {
    const all = readJson(SESSION_FILE, {});
    delete all[key];
    writePrivate(SESSION_FILE, all);
  },
};

function client() {
  const { url, anonKey } = loadConfig();
  return createClient(url, anonKey, {
    auth: {
      storage: fileStorage,
      persistSession: true,
      autoRefreshToken: false, // no background timers in a CLI; getSession() refreshes on demand
      detectSessionInUrl: false,
    },
  });
}

async function requireUser(sb) {
  const { data, error } = await sb.auth.getSession();
  if (error || !data.session) fail('Not logged in. Run: intervous login');
  return data.session.user;
}

// ---------------------------------------------------------------------------
// output helpers
// ---------------------------------------------------------------------------

function fail(msg, code = 1) {
  process.stderr.write(`intervous: ${msg}\n`);
  process.exit(code);
}

function out(obj, asJson) {
  if (asJson) {
    process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
    return;
  }
  if (Array.isArray(obj)) return table(obj);
  if (obj && typeof obj === 'object') {
    const w = Math.max(...Object.keys(obj).map((k) => k.length));
    for (const [k, v] of Object.entries(obj)) console.log(`${k.padEnd(w)}  ${fmt(v)}`);
    return;
  }
  console.log(obj);
}

function fmt(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function table(rows) {
  if (!rows.length) return console.log('(no rows)');
  const cols = Object.keys(rows[0]);
  const width = (c) => Math.min(40, Math.max(c.length, ...rows.map((r) => fmt(r[c]).length)));
  const ws = cols.map(width);
  const cell = (s, w) => (s.length > w ? s.slice(0, w - 1) + '…' : s.padEnd(w));
  console.log(cols.map((c, i) => cell(c, ws[i])).join('  '));
  console.log(ws.map((w) => '─'.repeat(w)).join('  '));
  for (const r of rows) console.log(cols.map((c, i) => cell(fmt(r[c]), ws[i])).join('  '));
  console.log(`\n${rows.length} row${rows.length === 1 ? '' : 's'}`);
}

// ---------------------------------------------------------------------------
// argument parsing: positionals, --flag value, --flag=value, repeatable --set/--where
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  const multi = new Set(['set', 'where']);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      pos.push(a);
      continue;
    }
    let [k, v] = a.slice(2).split(/=(.*)/s, 2);
    if (v === undefined) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        v = next;
        i++;
      } else v = true;
    }
    if (multi.has(k)) (flags[k] ??= []).push(v);
    else flags[k] = v;
  }
  return { pos, flags };
}

// "field=value" sets a string; "field:=value" parses value as JSON (numbers,
// booleans, null, arrays, objects).
function pairs(list = []) {
  const obj = {};
  for (const item of list) {
    const m = String(item).match(/^([^:=]+)(:?=)(.*)$/s);
    if (!m) fail(`Expected field=value or field:=json, got "${item}"`);
    const [, k, op, raw] = m;
    if (op === ':=') {
      try {
        obj[k] = JSON.parse(raw);
      } catch {
        fail(`Invalid JSON for ${k}: ${raw}`);
      }
    } else obj[k] = raw;
  }
  return obj;
}

function dataFlag(flags) {
  if (flags.file) {
    try {
      return JSON.parse(fs.readFileSync(flags.file, 'utf8'));
    } catch (e) {
      fail(`Cannot read JSON from ${flags.file}: ${e.message}`);
    }
  }
  if (flags.data) {
    try {
      return JSON.parse(flags.data);
    } catch (e) {
      fail(`--data is not valid JSON: ${e.message}`);
    }
  }
  if (flags.set) return pairs(flags.set);
  fail('Provide --data <json>, --file <path> or --set field=value');
}

function applyWhere(q, where) {
  for (const [k, v] of Object.entries(pairs(where))) q = v === null ? q.is(k, null) : q.eq(k, v);
  return q;
}

// ---------------------------------------------------------------------------
// hidden password prompt (raw mode, no echo)
// ---------------------------------------------------------------------------

function prompt(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (d) => {
      buf = String(d).replace(/\r?\n$/, '');
      process.stdin.pause();
      resolve(buf);
    });
    process.stdin.resume();
  });
}

function hiddenPrompt(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) fail('Password input needs an interactive terminal.');
    process.stdout.write(question);
    let pw = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (ch) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          return resolve(pw);
        }
        if (c === '\u0003') {
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(130);
        }
        if (c === '\u007f' || c === '\b') pw = pw.slice(0, -1);
        else pw += c;
      }
    };
    stdin.on('data', onData);
  });
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

const TABLES = ['jobs', 'companies', 'company_info', 'company_tags', 'company_tag_map', 'profiles'];

async function cmdLogin(sb, flags) {
  const email = flags.email && flags.email !== true ? flags.email : await prompt('Email: ');
  if (flags.otp) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) fail(error.message);
    const token = await prompt('Code from the email: ');
    const { data, error: e2 } = await sb.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
    if (e2) fail(e2.message);
    return console.log(`Logged in as ${data.user.email}`);
  }
  const password = await hiddenPrompt('Password (hidden): ');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) fail(error.message);
  console.log(`Logged in as ${data.user.email}. Session saved to ${SESSION_FILE}`);
}

async function cmdLogout(sb) {
  await sb.auth.signOut({ scope: 'local' });
  try {
    fs.unlinkSync(SESSION_FILE);
  } catch {}
  console.log('Logged out.');
}

async function cmdWhoami(sb, flags) {
  const user = await requireUser(sb);
  const { data: s } = await sb.auth.getSession();
  out(
    {
      email: user.email,
      user_id: user.id,
      session_expires: new Date(s.session.expires_at * 1000).toISOString(),
    },
    flags.json,
  );
}

async function cmdStatus(sb, flags) {
  const user = await requireUser(sb);
  const counts = {};
  for (const t of TABLES) {
    const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
    counts[t] = error ? `error: ${error.message}` : count;
  }
  out({ email: user.email, ...counts }, flags.json);
}

async function cmdJobs(sb, sub, pos, flags) {
  const user = await requireUser(sb);
  if (!sub || sub === 'list') {
    let q = sb.from('jobs').select('*').eq('user_id', user.id).order('application_date', { ascending: false });
    if (flags.status) q = q.eq('status', flags.status);
    if (flags.limit) q = q.limit(Number(flags.limit));
    const { data, error } = await q;
    if (error) fail(error.message);
    const rows = flags.json ? data : data.map(({ id, application_date, company_name, role, location, status, stage }) => ({ id, date: application_date, company: company_name, role, location, status, stage }));
    return out(rows, flags.json);
  }
  if (sub === 'get') {
    const { data, error } = await sb.from('jobs').select('*').eq('id', pos[0]).single();
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  if (sub === 'add') {
    if (!flags.company || !flags.role) fail('jobs add needs --company and --role');
    const row = {
      user_id: user.id,
      company_name: flags.company,
      role: flags.role,
      location: flags.location ?? '',
      url: flags.url ?? '',
      application_date: flags.date ?? new Date().toISOString().slice(0, 10),
      status: flags.status ?? 'Applied',
      stage: flags.stage ?? '',
      ...pairs(flags.set),
    };
    const { data, error } = await sb.from('jobs').insert([row]).select().single();
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  if (sub === 'update') {
    const patch = dataFlag(flags);
    const { data, error } = await sb.from('jobs').update(patch).eq('id', pos[0]).eq('user_id', user.id).select().single();
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  if (sub === 'delete') {
    if (!flags.yes) fail('Refusing to delete without --yes');
    const { error } = await sb.from('jobs').delete().eq('id', pos[0]).eq('user_id', user.id);
    if (error) fail(error.message);
    return console.log(`Deleted job ${pos[0]}`);
  }
  fail(`Unknown jobs subcommand: ${sub}`);
}

async function cmdCompanies(sb, sub, pos, flags) {
  await requireUser(sb);
  if (!sub || sub === 'list') {
    const { data, error } = await sb.from('companies').select('id, name, website').order('name');
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  if (sub === 'get') {
    const { data, error } = await sb.from('companies').select('*, company_info(*), company_tag_map(company_tags(name))').eq('id', pos[0]).single();
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  fail(`Unknown companies subcommand: ${sub}`);
}

async function cmdDb(sb, sub, pos, flags) {
  await requireUser(sb);
  const tableName = pos[0];
  if (!tableName) fail('db <select|insert|update|delete> <table> ...');
  if (sub === 'select') {
    let q = sb.from(tableName).select(flags.columns ?? '*');
    q = applyWhere(q, flags.where);
    if (flags.order) {
      const [col, dir] = String(flags.order).split('.');
      q = q.order(col, { ascending: dir !== 'desc' });
    }
    if (flags.limit) q = q.limit(Number(flags.limit));
    const { data, error } = await q;
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  if (sub === 'insert') {
    const rows = dataFlag(flags);
    const { data, error } = await sb.from(tableName).insert(Array.isArray(rows) ? rows : [rows]).select();
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  if (sub === 'update') {
    if (!flags.where) fail('db update needs at least one --where');
    let q = sb.from(tableName).update(dataFlag(flags));
    q = applyWhere(q, flags.where);
    const { data, error } = await q.select();
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  if (sub === 'delete') {
    if (!flags.where) fail('db delete needs at least one --where');
    if (!flags.yes) fail('Refusing to delete without --yes');
    let q = sb.from(tableName).delete();
    q = applyWhere(q, flags.where);
    const { data, error } = await q.select();
    if (error) fail(error.message);
    return out({ deleted: data.length }, flags.json);
  }
  fail(`Unknown db subcommand: ${sub}`);
}

async function cmdStorage(sb, sub, pos, flags) {
  await requireUser(sb);
  const [bucket, a, b] = pos;
  if (sub === 'buckets') {
    const { data, error } = await sb.storage.listBuckets();
    if (error) fail(error.message);
    return out(data.map(({ id, public: pub }) => ({ id, public: pub })), flags.json);
  }
  if (!bucket) fail('storage <list|upload|download|url|remove> <bucket> ...');
  if (sub === 'list') {
    const { data, error } = await sb.storage.from(bucket).list(a ?? '', { limit: 1000 });
    if (error) fail(error.message);
    return out(data.map(({ name, metadata, updated_at }) => ({ name, size: metadata?.size ?? '', updated_at })), flags.json);
  }
  if (sub === 'upload') {
    if (!a || !b) fail('storage upload <bucket> <local-file> <remote-path> [--upsert]');
    const body = fs.readFileSync(a);
    const contentType = a.endsWith('.pdf') ? 'application/pdf' : a.endsWith('.json') ? 'application/json' : a.endsWith('.md') ? 'text/markdown' : 'application/octet-stream';
    const { data, error } = await sb.storage.from(bucket).upload(b, body, { contentType, upsert: Boolean(flags.upsert) });
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  if (sub === 'download') {
    if (!a || !b) fail('storage download <bucket> <remote-path> <local-file>');
    const { data, error } = await sb.storage.from(bucket).download(a);
    if (error) fail(error.message);
    fs.writeFileSync(b, Buffer.from(await data.arrayBuffer()));
    return console.log(`Saved ${b}`);
  }
  if (sub === 'url') {
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(a, Number(flags.expires ?? 3600));
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  if (sub === 'remove') {
    if (!flags.yes) fail('Refusing to remove without --yes');
    const { data, error } = await sb.storage.from(bucket).remove([a]);
    if (error) fail(error.message);
    return out(data, flags.json);
  }
  fail(`Unknown storage subcommand: ${sub}`);
}

async function cmdExport(sb, flags) {
  const user = await requireUser(sb);
  const dump = { exported_at: new Date().toISOString(), user: { id: user.id, email: user.email } };
  for (const t of TABLES) {
    const { data, error } = await sb.from(t).select('*');
    dump[t] = error ? { error: error.message } : data;
  }
  const text = JSON.stringify(dump, null, 2);
  if (flags.out) {
    fs.writeFileSync(flags.out, text);
    return console.log(`Wrote ${flags.out}`);
  }
  process.stdout.write(text + '\n');
}

const HELP = `intervous — InterVous from the terminal, as your own user

  login [--email E] [--otp]        sign in (password prompt is hidden; --otp emails a code)
  logout                           forget the saved session
  whoami [--json]                  who the CLI is acting as
  status [--json]                  connection check + row counts per table

  jobs list [--status S] [--limit N] [--json]
  jobs get <id> [--json]
  jobs add --company C --role R [--location L] [--url U] [--date YYYY-MM-DD]
           [--status S] [--stage S] [--set field=value ...]
  jobs update <id> --set field=value [--set field:=json ...]   (or --data '{...}')
  jobs delete <id> --yes

  companies list | get <id> [--json]

  db select <table> [--where col=val ...] [--columns a,b] [--order col[.desc]] [--limit N]
  db insert <table> --data '<json object|array>' | --file rows.json | --set k=v ...
  db update <table> --where col=val --set k=v ...   (or --data '{...}')
  db delete <table> --where col=val --yes

  storage buckets
  storage list <bucket> [prefix]
  storage upload <bucket> <local-file> <remote-path> [--upsert]
  storage download <bucket> <remote-path> <local-file>
  storage url <bucket> <remote-path> [--expires seconds]
  storage remove <bucket> <remote-path> --yes

  export [--out file.json]         dump every table you can read

  field=value sets a string; field:=json parses the value (numbers, true, null, [..], {..}).
  Config and session live in ${CONFIG_DIR}.`;

async function main() {
  const [cmd, sub, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') return console.log(HELP);
  // login/logout/whoami/status/export take flags directly after the command
  const { pos, flags } = parseArgs(['jobs', 'companies', 'db', 'storage'].includes(cmd) ? rest : [sub, ...rest].filter((x) => x !== undefined));
  const sb = client();
  switch (cmd) {
    case 'login':
      return cmdLogin(sb, flags);
    case 'logout':
      return cmdLogout(sb);
    case 'whoami':
      return cmdWhoami(sb, flags);
    case 'status':
      return cmdStatus(sb, flags);
    case 'jobs':
      return cmdJobs(sb, sub, pos, flags);
    case 'companies':
      return cmdCompanies(sb, sub, pos, flags);
    case 'db':
      return cmdDb(sb, sub, pos, flags);
    case 'storage':
      return cmdStorage(sb, sub, pos, flags);
    case 'export':
      return cmdExport(sb, flags);
    default:
      fail(`Unknown command: ${cmd}. Run: intervous help`);
  }
}

main().catch((e) => fail(e?.message ?? String(e)));
