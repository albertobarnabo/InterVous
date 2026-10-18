// intervous today: the same queue as the /today page (lib/core/today.mjs), with the command that
// does each thing.
import { buildToday, itemToActions } from '../../lib/core/index.mjs';
import { loadCoreInput } from '../lib/jobs.mjs';
import { emitRead, usage, wrap } from '../lib/output.mjs';

export const options = {};

export async function run(ctx, pos) {
  if (pos.length) throw usage('today takes no arguments');
  const input = await loadCoreInput(ctx);
  const t = buildToday(input);
  const data = { ...t, actions: t.items.flatMap((it) => itemToActions(it, t.today)) };
  emitRead(ctx, data, print);
}

function print(t) {
  console.log(t.heading);
  console.log(t.summary.line);
  if (t.empty) {
    console.log(`\n${t.emptyLine}`);
  } else {
    console.log('');
    t.items.forEach((it, i) => {
      const who = it.company ? `${it.company} · ${it.role}` : null;
      console.log(`${String(i + 1).padStart(2)}. ${it.reason}${who ? ` — ${who}` : ''}`);
      if (it.evidence) console.log(wrap(it.evidence, 88, '    '));
      if (it.type === 'confirm_facts') for (const q of it.questions.slice(0, 8)) console.log(wrap(`${q.company}: ${q.text}`, 88, '    · '));
      if (it.type === 'no_reply') for (const e of it.entries) console.log(`    · ${e.company} · ${e.role} (${e.days} days${e.unconfirmed ? ', unconfirmed' : ''})`);
      if (it.type === 'fix_base_cv') for (const tp of it.topics) console.log(`    · ${tp.task} (${tp.apps.map((a) => a.company).join(', ')})`);
      const cmds = itemToActions(it, t.today).flatMap((a) => a.suggested_commands);
      for (const c of [...new Set(cmds)].slice(0, 3)) console.log(`    $ ${c}`);
    });
  }
  if (t.comingUp.interviews.length || t.comingUp.closing.length) {
    console.log('\nComing up');
    for (const x of t.comingUp.interviews) console.log(`  interview  ${x.on ?? '?'}  ${x.company} · ${x.role}`);
    for (const x of t.comingUp.closing) console.log(`  closes     ${x.on ?? '?'}  ${x.company} · ${x.role}`);
  }
  console.log(`\nReplies so far: ${t.replies.line}`);
}
