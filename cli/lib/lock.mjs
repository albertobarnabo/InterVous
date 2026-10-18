// The refresh lock (spec 6.1). Supabase rotates the refresh token on every refresh, so two CLI
// processes that refresh at the same time would spend the same token and one of them would be
// signed out. The lock serialises every session read/refresh:
//   * file ~/.config/intervous/session.lock, created with fs.openSync(p, 'wx')
//   * it holds the pid and a timestamp; retried every 50ms for up to 10s; stale after 30s
//   * it is passed to supabase-js as `auth.lock`, so it is held around getSession() and every
//     refresh, and supabase-js re-reads session.json after it is acquired.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { ensureConfigDir, lockFile } from './config.mjs';
import { CliError, EXIT } from './output.mjs';

export const LOCK_RETRY_MS = 50;
export const LOCK_TIMEOUT_MS = 10_000;
export const LOCK_STALE_MS = 30_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readLock(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const [pid, at, token] = raw.trim().split(/\s+/);
    return { pid: Number(pid), at: Number(at), token, raw };
  } catch {
    return null;
  }
}

function lockAge(file, info) {
  if (info && Number.isFinite(info.at)) return Date.now() - info.at;
  try {
    return Date.now() - fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Take the lock file. Resolves to a release function.
 * @param {{ file?: string, timeoutMs?: number, retryMs?: number, staleMs?: number }} [opts]
 * @returns {Promise<() => void>}
 */
export async function acquireFileLock(opts = {}) {
  const file = opts.file ?? lockFile();
  const timeoutMs = opts.timeoutMs ?? LOCK_TIMEOUT_MS;
  const retryMs = opts.retryMs ?? LOCK_RETRY_MS;
  const staleMs = opts.staleMs ?? LOCK_STALE_MS;
  if (!opts.file) ensureConfigDir();
  const token = crypto.randomBytes(6).toString('hex');
  const t0 = Date.now();
  for (;;) {
    try {
      const fd = fs.openSync(file, 'wx', 0o600);
      try {
        fs.writeSync(fd, `${process.pid} ${Date.now()} ${token}\n`);
      } finally {
        fs.closeSync(fd);
      }
      return () => {
        // only remove our own lock (a stale-lock breaker may have replaced it)
        const info = readLock(file);
        if (info?.token === token) fs.rmSync(file, { force: true });
      };
    } catch (e) {
      if (/** @type {NodeJS.ErrnoException} */ (e).code !== 'EEXIST') throw e;
    }
    const info = readLock(file);
    if (lockAge(file, info) > staleMs) {
      // stale: its owner crashed or hung. Remove it only if it is still the same lock.
      const again = readLock(file);
      if (!info || again?.raw === info.raw) fs.rmSync(file, { force: true });
      continue;
    }
    if (Date.now() - t0 >= timeoutMs) {
      throw new CliError(EXIT.SERVER, `Another intervous process has held the session lock for ${Math.round(lockAge(file, info) / 1000)}s${info?.pid ? ` (pid ${info.pid})` : ''}.`, {
        code: 'session_locked',
        hint: `Retry in a moment. If no other intervous command is running, delete ${file}.`,
      });
    }
    await sleep(retryMs);
  }
}

// One queue per process, so concurrent requests inside one command wait on a promise
// instead of polling the file against themselves.
let queue = Promise.resolve();

/**
 * Run `fn` while holding the lock file.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {Parameters<typeof acquireFileLock>[0]} [opts]
 * @returns {Promise<T>}
 */
export function withFileLock(fn, opts) {
  const run = queue.then(async () => {
    const release = await acquireFileLock(opts);
    try {
      return await fn();
    } finally {
      release();
    }
  });
  queue = run.then(() => undefined, () => undefined);
  return run;
}

/** supabase-js `auth.lock` implementation: (name, acquireTimeout, fn) => Promise. */
export function supabaseFileLock(_name, _acquireTimeout, fn) {
  return withFileLock(fn);
}
