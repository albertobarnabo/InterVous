// intervous login [--email E] [--otp]
// Only from a terminal: an agent or a script can never sign in (spec 6.1). No --password flag and
// no password environment variable; the password prompt is hidden.
import readline from 'node:readline/promises';
import { sessionFile } from '../lib/config.mjs';
import { CliError, EXIT, fromSupabase } from '../lib/output.mjs';

export const options = {
  email: { type: 'string' },
  otp: { type: 'boolean' },
};

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

function hiddenPrompt(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    let pw = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      process.stdout.write('\n');
    };
    const onData = (chunk) => {
      for (const c of String(chunk)) {
        if (c === '\r' || c === '\n') {
          done();
          return resolve(pw);
        }
        if (c === '\u0003') {
          done();
          process.exit(130);
        }
        if (c === '\u007f' || c === '\b') pw = pw.slice(0, -1);
        else pw += c;
      }
    };
    stdin.on('data', onData);
  });
}

export async function run(ctx, _pos, flags) {
  if (!process.stdin.isTTY) {
    throw new CliError(EXIT.AUTH, 'Run this yourself in a terminal.', { code: 'needs_terminal', hint: '`intervous login` only works from an interactive terminal.' });
  }
  const sb = ctx.sb;
  const email = flags.email || (await ask('Email: '));
  if (!email) throw new CliError(EXIT.USAGE, 'No email given.');
  if (flags.otp) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) throw fromSupabase(error, 'send the code');
    const token = await ask('Code from the email: ');
    const { data, error: e2 } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (e2) throw new CliError(EXIT.AUTH, `Sign-in failed: ${e2.message}`, { code: 'login_failed' });
    console.log(`Logged in as ${data.user?.email}. Session saved to ${sessionFile()}`);
    return;
  }
  const password = await hiddenPrompt('Password (hidden): ');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new CliError(EXIT.AUTH, `Sign-in failed: ${error.message}`, { code: 'login_failed' });
  console.log(`Logged in as ${data.user.email}. Session saved to ${sessionFile()}`);
}
