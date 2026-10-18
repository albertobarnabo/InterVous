// intervous insights [--only actions] [--all] [--only-confirmed]
// The same numbers as the /insights page (lib/core/insights.mjs), with the sample-size rule applied:
// counts below n = 20, a range from 20, a percentage from 30.
//   --only actions   {generated_on, actions:[{type, slug, company, role, days, reason, suggested_commands}]}
//   --all            every row, not just the campaign window
//   --only-confirmed leave out rows with unconfirmed facts
import { insightsForCli, todayActions } from '../../lib/core/index.mjs';
import { loadCoreInput } from '../lib/jobs.mjs';
import { emitRead, usage, wrap } from '../lib/output.mjs';

export const options = {
  only: { type: 'string' },
  all: { type: 'boolean' },
  'only-confirmed': { type: 'boolean' },
};

export async function run(ctx, pos, flags) {
  if (pos.length) throw usage('insights takes no positional arguments', 'intervous insights [--only actions] [--all] [--only-confirmed]');
  if (flags.only !== undefined && flags.only !== 'actions') throw usage(`--only accepts "actions"; got "${flags.only}"`);
  const input = await loadCoreInput(ctx);
  if (flags.only === 'actions') {
    return emitRead(ctx, todayActions(input), printActions);
  }
  const data = insightsForCli(input, { window: flags.all ? 'all' : 'campaign', onlyConfirmed: Boolean(flags['only-confirmed']) });
  emitRead(ctx, data, (d) => {
    console.log(`Insights · ${d.window === 'all' ? 'all rows' : 'campaign window'} · ${d.generated_on}`);
    console.log(wrap(d.intro, 88));
    for (const s of d.insights) {
      console.log(`\n${s.id.toUpperCase()}. ${s.question}`);
      console.log(wrap(s.answer, 88, '   '));
      if (s.what_to_do) console.log(wrap(`What to do: ${s.what_to_do}`, 88, '   '));
    }
    if (d.older?.count) console.log(`\n${d.older.label}: ${d.older.note}`);
    printActions(d);
  });
}

function printActions(d) {
  console.log(`\nActions (${d.actions.length})`);
  if (!d.actions.length) console.log('  Nothing needs you.');
  for (const a of d.actions) {
    console.log(wrap(`${a.company ? `${a.company}: ` : ''}${a.reason}`, 88, '  · '));
    for (const c of a.suggested_commands) console.log(`      $ ${c}`);
  }
}
