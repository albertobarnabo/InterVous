// Output, errors and exit codes (spec 6.3, 6.4).
//
// JSON mode (--json, or whenever stdout is not a terminal):
//   * read commands (list, show, find, today, insights, doctor, ...) print their data as JSON;
//   * write commands (add, sent, log, move, ...) print {"ok": true, "data": {...}};
//   * errors go to stderr as {"ok": false, "error": {"code", "message", "hint"}}.
// Otherwise output is plain text for a person.

export const EXIT = Object.freeze({
  OK: 0,
  USAGE: 1, // usage or validation error
  AUTH: 2, // not logged in, or refresh failed
  NOT_FOUND: 3,
  CONFLICT: 4, // ambiguous ref, slug already taken
  SERVER: 5, // network or server error
  SCHEMA: 6, // the v2 migration is missing
});

export const LOGIN_HINT = 'Ask Alberto to run `intervous login` in his terminal.';
export const SCHEMA_HINT = 'Run the v2 migration (supabase/migrations/20261017120000_intervous_v2.sql).';

export class CliError extends Error {
  /**
   * @param {number} exit
   * @param {string} message
   * @param {{ code?: string, hint?: string | null, details?: unknown }} [extra]
   */
  constructor(exit, message, extra = {}) {
    super(message);
    this.exit = exit;
    this.code = extra.code ?? defaultCode(exit);
    this.hint = extra.hint ?? null;
    this.details = extra.details;
  }
}

function defaultCode(exit) {
  return { 1: 'usage', 2: 'not_logged_in', 3: 'not_found', 4: 'conflict', 5: 'server_error', 6: 'schema_missing' }[exit] ?? 'error';
}

export const usage = (message, hint) => new CliError(EXIT.USAGE, message, { code: 'usage', hint });
export const invalid = (message, hint, details) => new CliError(EXIT.USAGE, message, { code: 'invalid', hint, details });
export const notFound = (message, hint) => new CliError(EXIT.NOT_FOUND, message, { code: 'not_found', hint });
export const conflict = (message, hint, details) => new CliError(EXIT.CONFLICT, message, { code: 'conflict', hint, details });
export const notLoggedIn = (message = 'Not logged in.') => new CliError(EXIT.AUTH, message, { code: 'not_logged_in', hint: LOGIN_HINT });

const SCHEMA_CODES = new Set(['PGRST202', 'PGRST205', 'PGRST200', 'PGRST204', '42P01', '42883', '42703']);
const AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303', '28000', 'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'bad_jwt']);
const VALIDATION_CODES = new Set(['22023', '22P02', '22007', '22008', '23514', '23502', '22001', '22003', 'PGRST100', 'PGRST102']);

/**
 * Turn a supabase-js / PostgREST / storage / auth error into a CliError with the right exit code.
 * @param {any} error
 * @param {string} [what]  what was being done, e.g. 'load the application'
 * @param {{ schemaHint?: boolean }} [opts]
 */
export function fromSupabase(error, what, opts = {}) {
  if (error instanceof CliError) return error;
  const code = String(error?.code ?? '');
  const status = Number(error?.status ?? error?.statusCode ?? 0);
  const msg = String(error?.message ?? error ?? 'unknown error');
  const prefix = what ? `Could not ${what}: ` : '';
  const name = String(error?.name ?? '');
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network/i.test(msg) || name === 'AuthRetryableFetchError') {
    return new CliError(EXIT.SERVER, `${prefix}network error (${msg.replace(/^TypeError: /, '')})`, { code: 'network', hint: 'Check the connection and retry.' });
  }
  if (SCHEMA_CODES.has(code)) {
    // legacy debugging commands take raw table/column names: there it is a typo, not a missing migration
    if (opts.schemaHint === false) return new CliError(EXIT.USAGE, `${prefix}${msg}`, { code: 'invalid', details: { pg: code } });
    return new CliError(EXIT.SCHEMA, `${prefix}${msg}`, { code: 'schema_missing', hint: SCHEMA_HINT, details: { pg: code } });
  }
  if (AUTH_CODES.has(code) || status === 401 || /jwt expired|invalid refresh token|refresh token/i.test(msg) || name === 'AuthSessionMissingError') {
    return new CliError(EXIT.AUTH, `${prefix}${msg}`, { code: 'not_logged_in', hint: LOGIN_HINT, details: { pg: code || undefined } });
  }
  if (code === '23505' || status === 409) return new CliError(EXIT.CONFLICT, `${prefix}${msg}`, { code: 'conflict', details: { pg: code || undefined } });
  if (code === 'P0002' || code === '23503' || code === 'PGRST116') return new CliError(EXIT.NOT_FOUND, `${prefix}${msg}`, { code: 'not_found', details: { pg: code } });
  if (VALIDATION_CODES.has(code)) return new CliError(EXIT.USAGE, `${prefix}${msg}`, { code: 'invalid', details: { pg: code } });
  if (code === '42501') {
    return new CliError(EXIT.SERVER, `${prefix}${msg}`, { code: 'forbidden', hint: 'Row-level security refused this. Is the CLI signed in as the owner of this application?', details: { pg: code } });
  }
  return new CliError(EXIT.SERVER, `${prefix}${msg}`, { code: 'server_error', details: { pg: code || undefined, status: status || undefined } });
}

/** Throw a CliError for a supabase-js result with an error; return its data otherwise. */
export function must(result, what, opts) {
  if (result?.error) throw fromSupabase(result.error, what, opts);
  return result?.data;
}

/** JSON output when asked, or whenever stdout is not a terminal. */
export function wantJson(flags = {}) {
  return Boolean(flags.json) || !process.stdout.isTTY;
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

/** Write-command result: {"ok": true, "data": ...} in JSON mode, else `human(data)`. */
export function emitWrite(ctx, data, human) {
  if (ctx.json) return printJson({ ok: true, data });
  human?.(data);
  printWarnings(data?.warnings);
}

/** Read-command result: the data itself in JSON mode, else `human(data)`. */
export function emitRead(ctx, data, human) {
  if (ctx.json) return printJson(data);
  human?.(data);
}

export function printWarnings(warnings) {
  for (const w of warnings ?? []) process.stderr.write(`warning: ${w}\n`);
}

/** Print an error the way 6.3 says and return the exit code. */
export function reportError(e, json) {
  let err = e instanceof CliError ? e : fromSupabase(e);
  if (!(e instanceof CliError) && err.code === 'server_error' && e instanceof Error && !('status' in e) && !('statusCode' in e)) {
    // a bug in the CLI, not an answer from the server
    err = new CliError(EXIT.SERVER, `Internal error: ${e.message}`, { code: 'internal', hint: 'Re-run with INTERVOUS_DEBUG=1 for the stack trace.' });
    if (process.env.INTERVOUS_DEBUG) process.stderr.write(`${e.stack}\n`);
  }
  if (json) {
    const error = { code: err.code, message: err.message, hint: err.hint };
    if (err.details !== undefined) error.details = err.details;
    process.stderr.write(`${JSON.stringify({ ok: false, error })}\n`);
  } else {
    process.stderr.write(`intervous: ${err.message}\n`);
    if (err.hint) process.stderr.write(`  ${err.hint}\n`);
    if (err.details && err.code !== 'schema_missing' && typeof err.details === 'object' && !('pg' in err.details)) {
      process.stderr.write(`  ${JSON.stringify(err.details)}\n`);
    }
  }
  return err.exit;
}

// ---------------------------------------------------------------------------
// plain-text helpers
// ---------------------------------------------------------------------------

export function fmt(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Aligned two-column key/value block. */
export function printKv(obj, indent = '') {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined);
  if (!keys.length) return;
  const w = Math.max(...keys.map((k) => k.length));
  for (const k of keys) console.log(`${indent}${k.padEnd(w)}  ${fmt(obj[k])}`);
}

/** A plain table; long cells are cut at `max` characters. */
export function printTable(rows, { max = 40, count = true } = {}) {
  if (!rows.length) return console.log('(no rows)');
  const cols = Object.keys(rows[0]);
  const ws = cols.map((c) => Math.min(max, Math.max(c.length, ...rows.map((r) => fmt(r[c]).length))));
  const cell = (s, w) => (s.length > w ? `${s.slice(0, w - 1)}…` : s.padEnd(w));
  console.log(cols.map((c, i) => cell(c, ws[i])).join('  ').trimEnd());
  console.log(ws.map((w) => '─'.repeat(w)).join('  '));
  for (const r of rows) console.log(cols.map((c, i) => cell(fmt(r[c]), ws[i])).join('  ').trimEnd());
  if (count) console.log(`\n${rows.length} row${rows.length === 1 ? '' : 's'}`);
}

/** Wrap text at `width` columns; the first line starts with `indent`, the rest line up under it. */
export function wrap(text, width = 88, indent = '') {
  const rest = ' '.repeat(indent.length);
  const out = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (line && line.length + word.length + 1 > width - indent.length) {
        out.push((out.length ? rest : indent) + line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    out.push((out.length ? rest : indent) + line);
  }
  return out.join('\n');
}
