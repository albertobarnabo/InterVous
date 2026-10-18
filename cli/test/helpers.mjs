// Test helpers: run the CLI as a child process against the local stack, with its own config dir
// (INTERVOUS_CONFIG_DIR) and HOME, so nothing ever reads or writes ~/.config/intervous.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CLI = path.join(ROOT, 'cli', 'intervous.mjs');

/** A fresh temp directory (removed by the caller with fs.rmSync). */
export function tempDir(prefix = 'intervous-cli-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Sign in through GoTrue and return the session object supabase-js stores. */
export async function signIn(stack, email, password) {
  const sb = createClient(stack.url, stack.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

/** Write a session where the CLI looks for it: {"intervous-cli": "<session json>"} in session.json. */
export function writeSession(configDir, session, key = 'intervous-cli') {
  fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(configDir, 'session.json'), JSON.stringify({ [key]: JSON.stringify(session) }), { mode: 0o600 });
}

export function readSession(configDir, key = 'intervous-cli') {
  const all = JSON.parse(fs.readFileSync(path.join(configDir, 'session.json'), 'utf8'));
  return all[key] ? JSON.parse(all[key]) : null;
}

/**
 * A sandboxed CLI runner.
 * @param {{ url: string, anonKey: string }} stack
 * @param {{ configDir?: string, appUrl?: string }} [opts]
 */
export function sandbox(stack, opts = {}) {
  const home = tempDir('intervous-cli-home-');
  const configDir = opts.configDir ?? path.join(home, 'config');
  const env = {
    PATH: process.env.PATH,
    HOME: home,
    TZ: process.env.TZ ?? 'Europe/Berlin',
    INTERVOUS_URL: stack.url,
    INTERVOUS_ANON_KEY: stack.anonKey,
    INTERVOUS_CONFIG_DIR: configDir,
    INTERVOUS_APP_URL: opts.appUrl ?? 'https://example.test/intervous',
  };
  /**
   * @param {string[]} args
   * @param {{ input?: string, env?: Record<string, string> }} [o]
   * @returns {Promise<{ code: number, stdout: string, stderr: string, json: any, error: any }>}
   */
  const run = (args, o = {}) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd: home, env: { ...env, ...(o.env ?? {}) }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      const parse = (s) => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      };
      const errLine = stderr.trim().split('\n').reverse().find((l) => l.startsWith('{"ok":false'));
      resolve({ code: code ?? -1, stdout, stderr, json: parse(stdout), error: errLine ? parse(errLine).error : null });
    });
    child.stdin.end(o.input ?? '');
  });
  return { home, configDir, env, run, cleanup: () => fs.rmSync(home, { recursive: true, force: true }) };
}

/** A user of their own and a signed-in sandbox for them. */
export async function signedInSandbox(stack, tag = 'user') {
  const email = `${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
  const password = `pw-${Math.random().toString(36).slice(2)}-Aa1`;
  const user = await stack.createUser(email, password);
  const box = sandbox(stack);
  writeSession(box.configDir, await signIn(stack, email, password));
  return { ...box, user, email, password };
}

/** Write a file (creating folders) and return its absolute path. */
export function put(dir, rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

/** A tiny but valid one-page PDF. */
export function tinyPdf(text = 'Alberto Barnabo CV') {
  const body = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${body.length} >>\nstream\n${body}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
