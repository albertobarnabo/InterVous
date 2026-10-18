#!/usr/bin/env node
// intervous: InterVous from the terminal, as the signed-in user (spec section 6).
//
// This file is only the command registry and argument parsing (node:util parseArgs). Commands live
// in cli/commands/<name>.mjs and export `options` (parseArgs options) and `run(ctx, positionals, flags)`;
// helpers live in cli/lib/. Today and Insights come from lib/core, so they exist exactly once.
//
// Agent rules: never run `login`, never read session.json; on exit 2 ask Alberto to run
// `intervous login` in his terminal; on exit 6 the v2 migration is missing.
import { parseArgs } from 'node:util';
import { configDir } from './lib/config.mjs';
import { makeContext } from './lib/auth.mjs';
import { CliError, EXIT, reportError, usage, wantJson } from './lib/output.mjs';

/**
 * name -> [module, export or null, usage, summary]
 * @type {Array<[string, string, string | null, string, string, string]>}
 */
const COMMANDS = [
  ['login', 'login', null, 'login [--email E] [--otp]', 'sign in (terminal only; the password prompt is hidden)', 'Session'],
  ['logout', 'logout', null, 'logout', 'forget the saved session', 'Session'],
  ['whoami', 'whoami', null, 'whoami', 'who the CLI acts as', 'Session'],
  ['doctor', 'doctor', null, 'doctor [--orphans]', 'read-only check: config, session, migration, bucket', 'Session'],

  ['find', 'find', null, 'find --url U | --company C [--role R]', 'duplicate check before building a CV', 'Applications'],
  ['add', 'add', null, 'add <manifest.json> [--dry-run]', 'the whole application in one call (spec 6.3)', 'Applications'],
  ['show', 'show', null, 'show <ref>', 'job, timeline, documents (signed URLs), fit, proof points, answers, contacts', 'Applications'],
  ['list', 'list', null, 'list [--phase P,P] [--since DATE] [--group G]', 'every application, grouped as on the web', 'Applications'],
  ['open', 'open', null, 'open <ref>', 'print the dossier link', 'Applications'],

  ['sent', 'sent', null, 'sent <ref> [--on DATE] [--cv PDF]', 'it went out: applied event, sent date, the CV marked as sent', 'Timeline'],
  ['log', 'log', null, 'log <ref> <kind> [--on DATE] [--at ISO] [--title T] [--body B] [--contact NAME]', 'add an event (reply, interview_scheduled, rejection, offer, ...)', 'Timeline'],
  ['move', 'move', null, 'move <ref> <phase> [--on DATE] [--note T]', 'set the phase directly (a phase_change event)', 'Timeline'],
  ['next', 'next', null, 'next <ref> "text" [--due DATE] | next <ref> --clear', 'the next action and its due date', 'Timeline'],
  ['confirm', 'confirm', null, 'confirm <ref> <field...>', 'mark unconfirmed facts as confirmed', 'Timeline'],
  ['feedback', 'feedback', null, 'feedback <ref> passed|interview --stage S|rejected|no_response|offer|withdrawn', 'old outcome shortcut, mapped onto log / move', 'Timeline'],

  ['attach', 'attach', null, 'attach <ref> <file> --kind cv_pdf|cv_source|cover_letter|other [--submitted] [--label L]', 'upload a file to the application', 'Documents'],
  ['jd', 'jd', null, 'jd <ref> <file.md> [--source-url U] [--captured-at ISO]', 'store the job description as captured', 'Documents'],
  ['answer', 'answer', null, 'answer <ref> --question Q (--file F | --text T) [--limit N] [--submitted]', 'save an application answer', 'Documents'],
  ['proof', 'proof', null, 'proof list | proof set <key> [--name N] [--metric M] [--status S] [--caveat C] [--fact k=v ...]', 'proof points and their true numbers', 'Documents'],

  ['today', 'today', null, 'today', 'the same queue as /today', 'Queues'],
  ['insights', 'insights', null, 'insights [--only actions] [--all] [--only-confirmed]', 'the same numbers as /insights, sample-size rule applied', 'Queues'],
  ['import', 'import', null, 'import <history.json> --map <adopt.json> [--dry-run] [--only slug,slug] [--emit-fixture FILE]', 'the one-time history import (section 7)', 'Queues'],

  ['status', 'legacy', 'status', 'status', 'row counts per table', 'Debugging'],
  ['jobs', 'legacy', 'jobs', 'jobs list|get <id>|add --company C --role R [--phase P]|update <id> --set k=v|delete <id> --yes', 'raw jobs rows', 'Debugging'],
  ['companies', 'legacy', 'companies', 'companies list | get <id>', 'raw companies rows', 'Debugging'],
  ['db', 'legacy', 'db', 'db select|insert|update|delete <table> [--where k=v] [--set k=v] [--data JSON] [--yes]', 'any table you can reach through RLS', 'Debugging'],
  ['storage', 'legacy', 'storage', 'storage buckets | list|upload|download|url|remove <bucket> ...', 'raw storage access', 'Debugging'],
  ['export', 'legacy', 'exportAll', 'export [--out file.json]', 'dump every table you can read', 'Debugging'],
];
const BY_NAME = new Map(COMMANDS.map((c) => [c[0], c]));

const GLOBAL_OPTIONS = {
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
};

function help() {
  const groups = [...new Set(COMMANDS.map((c) => c[5]))];
  const lines = ['intervous: InterVous from the terminal, as your own user', ''];
  for (const g of groups) {
    lines.push(g);
    for (const c of COMMANDS.filter((x) => x[5] === g)) lines.push(`  ${c[3]}`, `      ${c[4]}`);
    lines.push('');
  }
  lines.push(
    '<ref> is a slug, a unique slug prefix, or a numeric id. Dates are YYYY-MM-DD.',
    'Add --json for machine-readable output (automatic when stdout is not a terminal): read commands',
    'print their data, write commands print {"ok": true, "data": ...}, errors go to stderr as',
    '{"ok": false, "error": {"code", "message", "hint"}}.',
    'Exit codes: 0 ok, 1 usage or validation, 2 not logged in, 3 not found, 4 conflict, 5 network/server, 6 migration missing.',
    `Config and session live in ${configDir()} (override with INTERVOUS_CONFIG_DIR; INTERVOUS_URL and INTERVOUS_ANON_KEY override the project).`,
  );
  return lines.join('\n');
}

async function loadCommand(entry) {
  const [name, file, exp] = entry;
  let mod;
  try {
    mod = await import(`./commands/${file}.mjs`);
  } catch (e) {
    const err = /** @type {NodeJS.ErrnoException & { url?: string }} */ (e);
    if (name === 'import' && err.code === 'ERR_MODULE_NOT_FOUND' && String(err.url ?? err.message).includes('commands/import.mjs')) {
      return {
        options: null,
        run() {
          throw new CliError(EXIT.USAGE, 'intervous import is not built yet: it arrives with the history import (WP4).', { code: 'not_implemented', hint: 'Use `intervous add <manifest.json>` for one application.' });
        },
      };
    }
    throw e;
  }
  const cmd = exp ? mod[exp] : mod;
  if (!cmd?.run) throw new Error(`cli/commands/${file}.mjs does not export run()`);
  return cmd;
}

async function main(argv) {
  const [name, ...rest] = argv;
  if (!name || name === 'help' || name === '--help' || name === '-h') {
    const entry = rest[0] && BY_NAME.get(rest[0]);
    console.log(entry ? `intervous ${entry[3]}\n  ${entry[4]}` : help());
    return;
  }
  const entry = BY_NAME.get(name);
  if (!entry) throw usage(`Unknown command: ${name}`, 'Run `intervous help` for the list.');
  const cmd = await loadCommand(entry);
  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: { ...GLOBAL_OPTIONS, ...(cmd.options ?? {}) }, allowPositionals: true, strict: cmd.options !== null });
  } catch (e) {
    throw usage(/** @type {Error} */ (e).message.replace(/\. To specify a positional argument.*$/s, ''), `Usage: intervous ${entry[3]}`);
  }
  const flags = parsed.values;
  if (flags.help) {
    console.log(`intervous ${entry[3]}\n  ${entry[4]}`);
    return;
  }
  const ctx = makeContext({ json: wantJson(flags), flags, command: name });
  await cmd.run(ctx, parsed.positionals, flags);
}

const argv = process.argv.slice(2);
main(argv).catch((e) => {
  process.exitCode = reportError(e, argv.includes('--json') || !process.stdout.isTTY);
});
