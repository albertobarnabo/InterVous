// The Supabase client and the saved session.
//
// The session lives in ~/.config/intervous/session.json (directory 0700, file 0600), written
// atomically (write a .tmp file, then rename). Client options per spec 6.1: storageKey
// 'intervous-cli', autoRefreshToken false (no background timers; getSession() refreshes on demand),
// detectSessionInUrl false, and the refresh lock from lock.mjs.
//
// Only Alberto ever types a password: `login` refuses without a terminal (commands/login.mjs).
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { STORAGE_KEY, ensureConfigDir, legacyStorageKey, readConfig, sessionFile } from './config.mjs';
import { supabaseFileLock } from './lock.mjs';
import { CliError, EXIT, LOGIN_HINT, fromSupabase, notLoggedIn } from './output.mjs';

function readSessionFile() {
  try {
    const all = JSON.parse(fs.readFileSync(sessionFile(), 'utf8'));
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
}

function writeSessionFile(all) {
  ensureConfigDir();
  const file = sessionFile();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
  fs.chmodSync(tmp, 0o600);
  fs.renameSync(tmp, file);
}

/**
 * supabase-js storage adapter backed by session.json. Sessions saved by the pre-v2 CLI under the
 * default key (sb-<ref>-auth-token) are still read, and moved to 'intervous-cli' on the next write.
 * @param {string | null} legacyKey
 */
export function fileStorage(legacyKey) {
  return {
    getItem(key) {
      const all = readSessionFile();
      if (all[key] != null) return all[key];
      if (key === STORAGE_KEY && legacyKey && all[legacyKey] != null) return all[legacyKey];
      return null;
    },
    setItem(key, value) {
      const all = readSessionFile();
      all[key] = value;
      if (key === STORAGE_KEY && legacyKey) delete all[legacyKey];
      writeSessionFile(all);
    },
    removeItem(key) {
      const all = readSessionFile();
      if (!(key in all) && !(key === STORAGE_KEY && legacyKey && legacyKey in all)) return;
      delete all[key];
      if (key === STORAGE_KEY && legacyKey) delete all[legacyKey];
      writeSessionFile(all);
    },
  };
}

/** Config, or a usage error that says what is missing. */
export function requireConfig() {
  const cfg = readConfig();
  if (!cfg.url || !cfg.anonKey) throw new CliError(EXIT.USAGE, cfg.errors[0] ?? 'Supabase URL / anon key missing', { code: 'config_missing' });
  return cfg;
}

/** A supabase-js client acting as the saved session. */
export function createCliClient(cfg = requireConfig()) {
  return createClient(cfg.url, cfg.anonKey, {
    auth: {
      storage: fileStorage(legacyStorageKey(cfg.url)),
      storageKey: STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      lock: supabaseFileLock,
    },
  });
}

/**
 * The current session (refreshed under the lock when it has expired), or exit 2.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
export async function requireSession(sb) {
  let res;
  try {
    res = await sb.auth.getSession();
  } catch (e) {
    throw e instanceof CliError ? e : fromSupabase(e, 'read the session');
  }
  const { data, error } = res;
  if (error) {
    const err = fromSupabase(error, 'refresh the session');
    if (err.exit === EXIT.SERVER && err.code === 'network') throw err;
    throw new CliError(EXIT.AUTH, `Session refresh failed: ${error.message}`, { code: 'refresh_failed', hint: LOGIN_HINT });
  }
  if (!data.session) throw notLoggedIn();
  return data.session;
}

/**
 * Everything a command needs. Clients and the session are created on first use.
 * @param {{ json: boolean, flags: Record<string, any> }} base
 */
export function makeContext(base) {
  /** @type {import('@supabase/supabase-js').SupabaseClient | null} */
  let client = null;
  /** @type {any} */
  let session = null;
  /** @type {ReturnType<typeof readConfig> | null} */
  let cfg = null;
  const ctx = {
    ...base,
    get cfg() {
      cfg ??= requireConfig();
      return cfg;
    },
    get sb() {
      client ??= createCliClient(ctx.cfg);
      return client;
    },
    /** @returns {Promise<any>} */
    async session() {
      session ??= await requireSession(ctx.sb);
      return session;
    },
    async uid() {
      return (await ctx.session()).user.id;
    },
  };
  return ctx;
}
