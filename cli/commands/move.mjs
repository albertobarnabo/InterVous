// intervous move <ref> <phase> [--on DATE] [--note T]
// Sets the phase directly: inserts a phase_change event with to_phase=<phase>.
import { PHASES, phaseLabel } from '../../lib/core/index.mjs';
import { emitWrite, usage } from '../lib/output.mjs';
import { movePhase } from '../lib/timeline.mjs';

export const options = {
  on: { type: 'string' },
  note: { type: 'string' },
};

export async function run(ctx, pos, flags) {
  if (pos.length !== 2) throw usage('move takes <ref> <phase>', `intervous move <ref> ${PHASES.join('|')} [--on YYYY-MM-DD] [--note T]`);
  const data = await movePhase(ctx, pos[0], pos[1], flags);
  emitWrite(ctx, data, printMoved);
}

export function printMoved(d) {
  if (!d.event) return console.log(`${d.company} · ${d.role} is already ${phaseLabel(d.phase)}.`);
  console.log(d.moved ? `Moved ${d.company} · ${d.role}: ${phaseLabel(d.from)} → ${phaseLabel(d.phase)} (${d.event.occurred_on})` : `Logged a phase change for ${d.company}, phase stays ${phaseLabel(d.phase)}`);
}
