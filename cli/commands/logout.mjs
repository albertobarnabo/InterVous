// intervous logout: forget the saved session on this machine.
import fs from 'node:fs';
import { sessionFile } from '../lib/config.mjs';
import { emitWrite } from '../lib/output.mjs';

export const options = {};

export async function run(ctx) {
  try {
    await ctx.sb.auth.signOut({ scope: 'local' });
  } catch {
    /* offline or already signed out: still forget the local copy */
  }
  fs.rmSync(sessionFile(), { force: true });
  emitWrite(ctx, { logged_out: true }, () => console.log('Logged out.'));
}
