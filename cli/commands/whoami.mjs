// intervous whoami: who the CLI acts as (exit 2 when signed out).
import { emitRead, printKv } from '../lib/output.mjs';

export const options = {};

export async function run(ctx) {
  const s = await ctx.session();
  const data = {
    email: s.user.email,
    user_id: s.user.id,
    session_expires: s.expires_at ? new Date(s.expires_at * 1000).toISOString() : null,
    project: new URL(ctx.cfg.url).host,
  };
  emitRead(ctx, data, printKv);
}
