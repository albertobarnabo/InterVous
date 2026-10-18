// intervous list [--phase P,P] [--since DATE] [--group G]
// Every application, grouped like the Applications page (In interviews / Waiting / Not sent /
// Closed / Older records), each with its "now" sentence. --json prints a plain array.
import { LIST_GROUPS, PHASES, buildContext, listGroupOf, nowSentence, phaseLabel, waitingDays } from '../../lib/core/index.mjs';
import { jobUrl, loadCoreInput } from '../lib/jobs.mjs';
import { emitRead, usage } from '../lib/output.mjs';
import { checkDate } from '../lib/validate.mjs';

export const options = {
  phase: { type: 'string' },
  since: { type: 'string' },
  group: { type: 'string' },
};

const GROUP_IDS = LIST_GROUPS.map((g) => g.id);
const desc = (k) => (a, b) => String(b[k] ?? '').localeCompare(String(a[k] ?? ''));
/** Same order as the Applications page: latest activity / longest wait / newest CV / latest first. */
const SORTS = {
  interviews: desc('last_activity_at'),
  waiting: (a, b) => (b.waiting_days ?? -1) - (a.waiting_days ?? -1),
  not_sent: desc('cv_built_on'),
  closed: desc('updated_at'),
  older: desc('applied_on'),
};

export async function run(ctx, pos, flags) {
  if (pos.length) throw usage('list takes no positional arguments', 'intervous list [--phase applied,screening] [--since 2026-09-01] [--group waiting]');
  const phases = flags.phase ? String(flags.phase).split(',').map((s) => s.trim()).filter(Boolean) : null;
  for (const p of phases ?? []) if (!PHASES.includes(p)) throw usage(`Unknown phase "${p}"`, `Phases: ${PHASES.join(', ')}`);
  if (flags.since) checkDate(flags.since, '--since');
  const groups = flags.group ? String(flags.group).split(',').map((s) => s.trim()) : null;
  for (const g of groups ?? []) if (!GROUP_IDS.includes(g)) throw usage(`Unknown group "${g}"`, `Groups: ${GROUP_IDS.join(', ')}`);

  const input = await loadCoreInput(ctx);
  const core = buildContext(input);
  const rows = core.all
    .map((d) => ({ d, group: listGroupOf(d) }))
    .filter(({ d, group }) => (!phases || phases.includes(d.phase)) && (!groups || groups.includes(group)) && (!flags.since || (d.windowDate ?? '') >= flags.since))
    .map(({ d, group }) => ({
      ...d.app,
      ref: d.ref,
      group,
      now: nowSentence(d.app, { today: input.today, events: input.events, settings: input.settings }),
      waiting_days: waitingDays(d.app, { today: input.today, events: input.events, settings: input.settings }),
      app_url: jobUrl(ctx, d.app),
    }));

  emitRead(ctx, rows, (list) => {
    if (!list.length) return console.log('No applications match.');
    for (const g of LIST_GROUPS) {
      const inGroup = list.filter((r) => r.group === g.id).sort(SORTS[g.id] ?? (() => 0));
      if (!inGroup.length) continue;
      console.log(`\n${g.label} (${inGroup.length})${g.note ? ` · ${g.note}` : ''}`);
      for (const r of inGroup) {
        console.log(`  ${`${r.company_name} · ${r.role}`.slice(0, 60).padEnd(60)}  ${phaseLabel(r.phase).padEnd(12)}  ${r.ref}`);
        console.log(`  ${''.padEnd(2)}${r.now}`);
      }
    }
    console.log(`\n${list.length} application${list.length === 1 ? '' : 's'}`);
  });
}
