// intervous log <ref> <kind> [--on DATE] [--at ISO] [--title T] [--body B] [--contact NAME]
// Adds a timeline event. The phase follows through the trigger (reply: applied → screening,
// interview_scheduled → interviewing, rejection → rejected, offer → offer, ...).
import { EVENT_KIND_LABELS, phaseLabel } from '../../lib/core/index.mjs';
import { emitWrite, usage } from '../lib/output.mjs';
import { logEvent } from '../lib/timeline.mjs';

export const options = {
  on: { type: 'string' },
  at: { type: 'string' },
  title: { type: 'string' },
  body: { type: 'string' },
  contact: { type: 'string' },
};

export async function run(ctx, pos, flags) {
  if (pos.length !== 2) throw usage('log takes <ref> <kind>', 'intervous log <ref> reply|interview_scheduled|interview_done|rejection|offer|follow_up_sent|note|… [--on YYYY-MM-DD] [--at ISO] [--title T] [--body B] [--contact NAME]');
  const data = await logEvent(ctx, pos[0], pos[1], flags);
  emitWrite(ctx, data, printLogged);
}

export function printLogged(d) {
  const label = EVENT_KIND_LABELS[d.event.kind] ?? d.event.kind;
  if (d.duplicate) return console.log(`Already logged: ${label} on ${d.event.occurred_on} for ${d.company}.`);
  console.log(`Logged ${label} on ${d.event.occurred_on} for ${d.company} · ${d.role}${d.event.title ? `: ${d.event.title}` : ''}`);
  console.log(d.moved ? `  phase ${phaseLabel(d.phase_before)} → ${phaseLabel(d.phase)}` : `  phase stays ${phaseLabel(d.phase)}`);
}
