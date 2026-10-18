// Where the CLI keeps its files and how it finds the Supabase project.
//
// Config precedence (spec 6.1): env INTERVOUS_URL / INTERVOUS_ANON_KEY, then
// ~/.config/intervous/config.json ({url, anonKey, appUrl}), then the app's .env.
// The URL and anon key are public (the browser bundle ships them); nothing here is a secret.
//
// INTERVOUS_CONFIG_DIR moves the whole config directory (session, lock, config). The tests use it
// so they never touch ~/.config/intervous.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_APP_URL = 'https://albertobarnabo.com/intervous';
export const BUCKET = 'intervous-docs';
export const STORAGE_KEY = 'intervous-cli';

export function configDir() {
  return process.env.INTERVOUS_CONFIG_DIR || path.join(os.homedir(), '.config', 'intervous');
}
export const configFile = () => path.join(configDir(), 'config.json');
export const sessionFile = () => path.join(configDir(), 'session.json');
export const lockFile = () => path.join(configDir(), 'session.lock');

/** Create the config directory (0700) and tighten it if it already exists. */
export function ensureConfigDir() {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch {
    /* not ours to change; doctor reports it */
  }
  return dir;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function readDotEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const get = (k) => text.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), anonKey: get('NEXT_PUBLIC_SUPABASE_ANON_KEY') };
}

/**
 * @returns {{ url: string | null, anonKey: string | null, appUrl: string, source: string, errors: string[] }}
 *   `source` says where url/anonKey came from: 'env', 'config.json' or '.env'.
 */
export function readConfig() {
  const file = readJson(configFile()) ?? {};
  const appUrl = String(process.env.INTERVOUS_APP_URL || file.appUrl || DEFAULT_APP_URL).replace(/\/+$/, '');
  if (process.env.INTERVOUS_URL || process.env.INTERVOUS_ANON_KEY) {
    const errors = [];
    if (!process.env.INTERVOUS_URL) errors.push('INTERVOUS_ANON_KEY is set but INTERVOUS_URL is not');
    if (!process.env.INTERVOUS_ANON_KEY) errors.push('INTERVOUS_URL is set but INTERVOUS_ANON_KEY is not');
    return { url: process.env.INTERVOUS_URL ?? null, anonKey: process.env.INTERVOUS_ANON_KEY ?? null, appUrl, source: 'env', errors };
  }
  if (file.url && file.anonKey) return { url: file.url, anonKey: file.anonKey, appUrl, source: 'config.json', errors: [] };
  const envPath = path.join(APP_DIR, '.env');
  const env = readDotEnv(envPath);
  if (env?.url && env?.anonKey) return { url: env.url, anonKey: env.anonKey, appUrl, source: '.env', errors: [] };
  return {
    url: null, anonKey: null, appUrl, source: 'none',
    errors: [`No Supabase URL and anon key: set INTERVOUS_URL and INTERVOUS_ANON_KEY, or write ${configFile()}, or keep ${envPath}`],
  };
}

/** The default supabase-js storage key the CLI used before v2 ("sb-<project ref>-auth-token"). */
export function legacyStorageKey(url) {
  try {
    return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

/** '<appUrl>/applications/<slug or id>' */
export function appLink(appUrl, job) {
  return `${appUrl}/applications/${encodeURIComponent(job.slug ?? String(job.id))}`;
}
