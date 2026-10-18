#!/usr/bin/env node
// Re-checks every text/background token pair in src/app/globals.css against WCAG AA (4.5:1).
// Light only. Besides the flat surfaces it checks text on glass: 58% white over the page colour
// and over each backdrop colour field at full strength (the worst case under a glass card).
// Runs as part of `npm run lint`; exits 1 when a pair fails or a token is missing, or when a
// status colour drifts from lib/core/phases.mjs.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/app/globals.css'), 'utf8');

const MIN = 4.5;
const GLASS_ALPHA = 0.58;

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

// The first `:root {` block holds the colour tokens.
const t = tokens(block(':root {'));

if (/prefers-color-scheme:\s*dark/.test(css) || /data-theme="dark"/.test(css)) {
  console.error('contrast: globals.css has a dark theme block again; the app is light only');
  process.exit(1);
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** `top` at `alpha` over `under`, as #RRGGBB. */
function over(top, alpha, under) {
  return '#' + [1, 3, 5].map((i) => {
    const v = Math.round(parseInt(top.slice(i, i + 2), 16) * alpha + parseInt(under.slice(i, i + 2), 16) * (1 - alpha));
    return v.toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

// Derived backgrounds: glass over the page colour and over each colour field.
for (const f of ['bg', 'field-teal', 'field-blue', 'field-peach']) {
  if (t[f]) t[`glass-on-${f}`] = over('#FFFFFF', GLASS_ALPHA, t[f]);
}
const glassBacks = ['glass-on-bg', 'glass-on-field-teal', 'glass-on-field-blue', 'glass-on-field-peach'];

// [text token, background token]
const pairs = [];
for (const fg of ['ink', 'ink-2', 'ink-3']) {
  for (const bg of ['bg', 'surface', 'surface-2', ...glassBacks]) pairs.push([fg, bg]);
}
for (const bg of ['bg', 'surface', 'accent-soft', ...glassBacks]) pairs.push(['accent', bg]);
pairs.push(['accent-ink', 'accent'], ['accent-ink', 'accent-hover'], ['ink', 'accent-soft']);
for (const bg of ['bg', 'surface', 'danger-soft', ...glassBacks]) pairs.push(['danger', bg]);
pairs.push(['caution-fg', 'caution-bg']);

let failures = 0;
const rows = [];

// Status pills and the caution callout: token names and expected values come from
// lib/core/phases.mjs (the single source); globals.css must define exactly the light values.
let phases = null;
try {
  phases = await import(pathToFileURL(join(root, 'lib/core/phases.mjs')).href);
} catch {
  rows.push('note  lib/core/phases.mjs not found: checking the status tokens by name only');
}
const PHASE_IDS = ['draft', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'no_reply', 'withdrawn', 'skipped'];
for (const id of phases?.PHASES ?? PHASE_IDS) {
  const tok = phases?.phaseTokens ? phases.phaseTokens(id) : { fg: `--phase-${id.replace(/_/g, '-')}-fg`, bg: `--phase-${id.replace(/_/g, '-')}-bg` };
  pairs.push([tok.fg.slice(2), tok.bg.slice(2)]);
  const want = phases?.PHASE_COLORS?.[id]?.light;
  if (!want) continue;
  for (const part of ['fg', 'bg']) {
    const have = t[tok[part].slice(2)];
    if (have !== want[part].toUpperCase()) {
      failures++;
      rows.push(`FAIL ${tok[part]} is ${have ?? 'missing'}, lib/core/phases.mjs says ${want[part]}`);
    }
  }
}
if (phases?.CAUTION_COLORS?.light) {
  for (const part of ['fg', 'bg']) {
    const have = t[`caution-${part}`];
    if (have !== phases.CAUTION_COLORS.light[part].toUpperCase()) {
      failures++;
      rows.push(`FAIL --caution-${part} is ${have ?? 'missing'}, lib/core/phases.mjs says ${phases.CAUTION_COLORS.light[part]}`);
    }
  }
}

for (const [fg, bg] of pairs) {
  if (!t[fg] || !t[bg]) {
    failures++;
    rows.push(`FAIL ${fg} on ${bg}: token missing`);
    continue;
  }
  const r = ratio(t[fg], t[bg]);
  const ok = r >= MIN;
  if (!ok) failures++;
  rows.push(`${ok ? ' ok ' : 'FAIL'} ${`${fg} on ${bg}`.padEnd(48)} ${r.toFixed(2)}:1`);
}

const verbose = process.argv.includes('--verbose') || failures > 0;
if (verbose) console.log(rows.join('\n'));
if (failures) {
  console.error(`contrast: ${failures} problem(s); every text pair must reach ${MIN}:1`);
  process.exit(1);
}
console.log(`contrast: ${pairs.length} pairs pass ${MIN}:1 (light, including text on glass)`);
