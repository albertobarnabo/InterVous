// intervous feedback <ref> passed|interview --stage S|rejected|no_response|offer|withdrawn|note [--note N] [--date D]
// Kept for muscle memory from the pre-v2 CLI. It maps onto the v2 outcome logging:
//   passed       -> log interview_scheduled ("Passed the screen")
//   interview    -> log interview_scheduled, title = --stage
//   rejected     -> log rejection
//   no_response  -> move no_reply
//   offer        -> log offer
//   withdrawn    -> log withdrawn
//   note         -> log note
import { emitWrite, usage } from '../lib/output.mjs';
import { logEvent, movePhase } from '../lib/timeline.mjs';
import { printLogged } from './log.mjs';
import { printMoved } from './move.mjs';

export const options = {
  stage: { type: 'string' },
  note: { type: 'string' },
  date: { type: 'string' },
  on: { type: 'string' },
};

const OUTCOMES = ['passed', 'interview', 'rejected', 'no_response', 'offer', 'withdrawn', 'note'];

export async function run(ctx, pos, flags) {
  const [ref, outcome] = pos;
  if (pos.length !== 2 || !OUTCOMES.includes(outcome)) {
    throw usage(`feedback <ref> <${OUTCOMES.join('|')}> [--stage S] [--note N] [--date YYYY-MM-DD]`, 'New: `intervous log` and `intervous move` do the same with more control.');
  }
  if (outcome === 'interview' && !flags.stage) throw usage('feedback … interview needs --stage (e.g. "Technical Interview")');
  const on = flags.on ?? flags.date;
  if (outcome === 'no_response') {
    const data = { ...(await movePhase(ctx, ref, 'no_reply', { on, note: flags.note })), mapped_to: 'move no_reply' };
    return emitWrite(ctx, data, printMoved);
  }
  const kind = { passed: 'interview_scheduled', interview: 'interview_scheduled', rejected: 'rejection', offer: 'offer', withdrawn: 'withdrawn', note: 'note' }[outcome];
  const title = outcome === 'passed' ? (flags.stage ?? 'Passed the screen') : (flags.stage ?? undefined);
  const data = { ...(await logEvent(ctx, ref, kind, { on, title, body: flags.note })), mapped_to: `log ${kind}` };
  emitWrite(ctx, data, printLogged);
}
