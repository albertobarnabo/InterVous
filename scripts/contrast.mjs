#!/usr/bin/env node
// Re-checks every text/background token pair in src/app/globals.css against WCAG AA (4.5:1).
// Runs as part of `npm run lint`; exits 1 when a pair fails or a token is missing,
// or when the system-dark block drifts from the pinned-dark block.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8');

const MIN = 4.5;

/** Returns the body of the first `{...}` block that follows `selector`. */
function block(selector) {
  const at = css.indexOf(selector);
  if (at < 0) throw new Error(`selector not found in globals.css: ${selector}`);
  const open = css.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unclosed block for ${selector}`);
}

function tokens(body) {
  const out = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toUpperCase();
  return out;
}

const themes = {
  light: tokens(block(':root,\n[data-theme="light"]')),
  dark: tokens(block(':root[data-theme="dark"],\n[data-theme="dark"]')),
};
const systemDark = tokens(block(':root:not([data-theme="light"]) {'));

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [text token, background token]
const pairs = [
  ['ink', 'bg'], ['ink', 'surface'], ['ink', 'surface-2'],
  ['ink-2', 'bg'], ['ink-2', 'surface'], ['ink-2', 'surface-2'],
  ['ink-3', 'bg'], ['ink-3', 'surface'], ['ink-3', 'surface-2'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'accent-soft'],
  ['accent-ink', 'accent'],
  ['ink', 'accent-soft'],
  ['danger', 'bg'], ['danger', 'surface'], ['danger', 'danger-soft'],
  ['caution-fg', 'caution-bg'],
];

let failures = 0;
const rows = [];

// Phase pills and the caution callout: token names and expected values come from
// lib/core/phases.mjs (the single source); globals.css must define exactly those values.
let phases = null;
try {
  phases = await import(pathToFileURL(join(root, 'lib/core/phases.mjs')).href);
} catch {
  rows.push('note  lib/core/phases.mjs not found: checking the phase tokens by name only');
}
const PHASE_IDS = ['draft', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'no_reply', 'withdrawn', 'skipped'];
for (const id of phases?.PHASES ?? PHASE_IDS) {
  const t = phases?.phaseTokens ? phases.phaseTokens(id) : { fg: `--phase-${id.replace(/_/g, '-')}-fg`, bg: `--phase-${id.replace(/_/g, '-')}-bg` };
  pairs.push([t.fg.slice(2), t.bg.slice(2)]);
  const want = phases?.PHASE_COLORS?.[id];
  if (!want) continue;
  for (const theme of ['light', 'dark']) {
    for (const part of ['fg', 'bg']) {
      const have = themes[theme][t[part].slice(2)];
      if (have !== want[theme][part].toUpperCase()) {
        failures++;
        rows.push(`FAIL ${theme.padEnd(5)} ${t[part]} is ${have ?? 'missing'}, lib/core/phases.mjs says ${want[theme][part]}`);
      }
    }
  }
}
if (phases?.CAUTION_COLORS) {
  for (const theme of ['light', 'dark']) {
    for (const part of ['fg', 'bg']) {
      const have = themes[theme][`caution-${part}`];
      if (have !== phases.CAUTION_COLORS[theme][part].toUpperCase()) {
        failures++;
        rows.push(`FAIL ${theme.padEnd(5)} --caution-${part} is ${have ?? 'missing'}, lib/core/phases.mjs says ${phases.CAUTION_COLORS[theme][part]}`);
      }
    }
  }
}
for (const [theme, t] of Object.entries(themes)) {
  for (const [fg, bg] of pairs) {
    if (!t[fg] || !t[bg]) {
      failures++;
      rows.push(`FAIL ${theme.padEnd(5)} ${fg} on ${bg}: token missing`);
      continue;
    }
    const r = ratio(t[fg], t[bg]);
    const ok = r >= MIN;
    if (!ok) failures++;
    rows.push(`${ok ? ' ok ' : 'FAIL'} ${theme.padEnd(5)} ${`${fg} on ${bg}`.padEnd(46)} ${r.toFixed(2)}:1`);
  }
}

for (const [k, v] of Object.entries(themes.dark)) {
  if (systemDark[k] !== v) {
    failures++;
    rows.push(`FAIL drift --${k}: pinned dark ${v}, system dark ${systemDark[k] ?? 'missing'}`);
  }
}

const verbose = process.argv.includes('--verbose') || failures > 0;
if (verbose) console.log(rows.join('\n'));
if (failures) {
  console.error(`contrast: ${failures} problem(s); every text pair must reach ${MIN}:1`);
  process.exit(1);
}
console.log(`contrast: ${pairs.length * 2} pairs pass ${MIN}:1 in light and dark`);
