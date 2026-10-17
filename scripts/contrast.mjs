#!/usr/bin/env node
// Re-checks every text/background token pair in src/app/globals.css against WCAG AA (4.5:1).
// Runs as part of `npm run lint`; exits 1 when a pair fails or a token is missing,
// or when the system-dark block drifts from the pinned-dark block.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
  ['phase-draft-fg', 'phase-draft-bg'],
  ['phase-applied-fg', 'phase-applied-bg'],
  ['phase-screening-fg', 'phase-screening-bg'],
  ['phase-interviewing-fg', 'phase-interviewing-bg'],
  ['phase-offer-fg', 'phase-offer-bg'],
  ['phase-rejected-fg', 'phase-rejected-bg'],
  ['phase-closed-fg', 'phase-closed-bg'],
  ['caution-fg', 'caution-bg'],
];

let failures = 0;
const rows = [];
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
