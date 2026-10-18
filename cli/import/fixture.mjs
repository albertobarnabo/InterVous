// --emit-fixture (spec 7.4 step 6): the overview, events, fit and proof rows as one JSON file, in
// the shape of lib/core/test/fixture.json ({today, settings, apps, events, requirements,
// jobProofPoints, proofPoints, contacts}), for the WP2 tests and the dev fixture mode.
// It holds personal data, so it is written 0600 and never inside the app's repository.
import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR } from '../lib/config.mjs';
import { resolvePath } from '../lib/files.mjs';
import { loadCoreInput } from '../lib/jobs.mjs';
import { invalid } from '../lib/output.mjs';

/** Refuse a path inside the repository (it pushes to GitHub). */
export function checkFixturePath(file) {
  const abs = resolvePath(file);
  const rel = path.relative(APP_DIR, abs);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    throw invalid(`--emit-fixture ${abs} is inside the InterVous repository, which pushes to GitHub`, 'Write it next to the import maps, e.g. /Users/albi/Projects/cv/intervous-import/fixture.json.');
  }
  return abs;
}

/**
 * @param {any} ctx
 * @param {string} file absolute path (checked with checkFixturePath)
 */
export async function emitFixture(ctx, file) {
  const input = await loadCoreInput(ctx);
  const out = {
    _about: 'InterVous data as job_overview + child rows, written by `intervous import --emit-fixture` (spec 7.4.6). Personal data: keep it out of git.',
    generated_at: new Date().toISOString(),
    today: input.today,
    settings: input.settings,
    apps: input.apps,
    events: input.events,
    requirements: input.requirements,
    jobProofPoints: input.jobProofPoints,
    proofPoints: input.proofPoints,
    contacts: input.contacts,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(out, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
  return { file, apps: out.apps.length, events: out.events.length, requirements: out.requirements.length, jobProofPoints: out.jobProofPoints.length, proofPoints: out.proofPoints.length, contacts: out.contacts.length };
}
