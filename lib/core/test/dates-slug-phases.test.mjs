import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  daysBetween, addDays, weekday, isoWeekStart, isoWeek, formatShort, formatDay, todayIn, toDateOnly, isDateString,
  formatAgo, maxDate, minDate, pluralDays,
} from '../dates.mjs';
import { slugify, isValidSlug, resolveRef, normalizeUrl, appRef, appPath, escapeLike, SLUG_RE } from '../slug.mjs';
import {
  PHASES, PHASE_LABELS, phaseFromLegacy, legacyStatus, legacyStage, impliedPhase, defaultDirection, isSent,
  BOARD_COLUMNS, boardColumnOf, LIST_GROUPS, phaseGroup, PHASE_COLORS, PHASE_TOKENS, CAUTION_COLORS, phaseTokens, eventTitle,
} from '../phases.mjs';

const fx = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));

// --- dates -----------------------------------------------------------------

test('day arithmetic on calendar dates', () => {
  assert.equal(daysBetween('2026-08-30', '2026-10-17'), 48);
  assert.equal(daysBetween('2026-09-03', '2026-10-17'), 44);
  assert.equal(daysBetween('2026-09-15', '2026-10-17'), 32);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2); // across the DST change
  assert.equal(daysBetween(null, '2026-10-17'), null);
  assert.equal(addDays('2026-10-17', -7), '2026-10-10');
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
});

test('weekdays and ISO weeks', () => {
  assert.equal(weekday('2026-10-17'), 6); // Saturday
  assert.equal(weekday('2026-10-19'), 1); // Monday
  assert.equal(isoWeekStart('2026-08-30'), '2026-08-24'); // a Sunday belongs to the week of Monday 24 Aug
  assert.equal(isoWeekStart('2026-10-12'), '2026-10-12');
  assert.deepEqual(isoWeek('2026-10-17'), { year: 2026, week: 42 });
  assert.deepEqual(isoWeek('2027-01-01'), { year: 2026, week: 53 });
  assert.deepEqual(isoWeek('2024-12-30'), { year: 2025, week: 1 });
});

test('formatting', () => {
  assert.equal(formatShort('2026-08-30'), '30 Aug');
  assert.equal(formatShort('2025-10-19', { today: '2026-10-17' }), '19 Oct 2025');
  assert.equal(formatShort('2026-10-01', { today: '2026-10-17' }), '1 Oct');
  assert.equal(formatShort(null), '');
  assert.equal(formatDay('2026-10-17'), 'Sat 17 Oct');
  assert.equal(pluralDays(1), '1 day');
  assert.equal(pluralDays(48), '48 days');
  const now = new Date('2026-10-17T14:00:00Z');
  assert.equal(formatAgo('2026-10-17T12:00:00Z', now), '2h ago');
  assert.equal(formatAgo('2026-10-17T13:55:00Z', now), '5 min ago');
  assert.equal(formatAgo('2026-10-14T12:00:00Z', now), '3 days ago');
});

test('local dates and time zones', () => {
  assert.equal(todayIn('Europe/Berlin', new Date('2026-10-17T22:30:00Z')), '2026-10-18');
  assert.equal(todayIn('UTC', new Date('2026-10-17T22:30:00Z')), '2026-10-17');
  assert.equal(toDateOnly('2026-10-17T23:30:00Z', 'Europe/Berlin'), '2026-10-18');
  assert.equal(toDateOnly('2026-10-17T23:30:00+00:00'), '2026-10-17');
  assert.equal(toDateOnly('2026-10-17'), '2026-10-17');
  assert.equal(toDateOnly('2026-02-30'), null);
  assert.equal(toDateOnly(''), null);
  assert.equal(isDateString('2026-10-17'), true);
  assert.equal(isDateString('2026-13-01'), false);
  assert.equal(maxDate(null, '2026-09-30', '2026-10-01', undefined), '2026-10-01');
  assert.equal(minDate(null, '2026-09-30', '2026-10-01'), '2026-09-30');
});

// --- slugs -----------------------------------------------------------------

test('slugify gives valid slugs', () => {
  assert.equal(slugify('Mistral AI', 'Applied AI, Forward Deployed ML Engineer', 'London'), 'mistral-ai-applied-ai-forward-deployed-ml-engineer-london');
  assert.equal(slugify('Barnabò & Co'), 'barnabo-and-co');
  const long = slugify('European Central Bank', 'Internal move: SSM Governance & Operations - Technology & Innovation Division (TIN)', 'Frankfurt am Main, Germany');
  assert.ok(long.length <= 81 && isValidSlug(long), long);
  assert.equal(slugify('!!!'), '');
  assert.equal(isValidSlug('a'), false);
  assert.equal(isValidSlug('-ab'), false);
  assert.equal(isValidSlug('Apple'), false);
  assert.equal(isValidSlug('a'.repeat(82)), false);
  assert.equal(isValidSlug('a'.repeat(81)), true);
  for (const app of fx.apps) if (app.slug) assert.match(app.slug, SLUG_RE);
});

test('refs: slug, numeric id, unique prefix', () => {
  assert.equal(resolveRef('apple-developer-publications', fx.apps).app.id, 128);
  assert.equal(resolveRef('91', fx.apps).app.company_name, 'IMC Trading');
  assert.equal(resolveRef(128, fx.apps).app.slug, 'apple-developer-publications');
  assert.equal(resolveRef('apple', fx.apps).app.id, 128);
  const ecb = resolveRef('ecb', fx.apps);
  assert.equal(ecb.ok, false);
  assert.equal(ecb.error, 'ambiguous');
  assert.equal(ecb.matches.length, 4);
  assert.equal(resolveRef('openai', fx.apps).error, 'ambiguous');
  assert.equal(resolveRef('nope', fx.apps).error, 'not_found');
  assert.equal(appRef({ id: 91, slug: null }), '91');
  assert.equal(appPath({ id: 128, slug: 'apple-developer-publications' }), '/applications/apple-developer-publications');
});

test('URL key matches the RPC rule', () => {
  assert.equal(normalizeUrl('https://jobs.lever.co/mistral/fde?lever-source=li'), 'https://jobs.lever.co/mistral/fde');
  assert.equal(normalizeUrl('https://jobs.apple.com/en-us/details/200660448-2114/'), 'https://jobs.apple.com/en-us/details/200660448-2114');
  assert.equal(normalizeUrl('https://x.io/a/?q=1'), normalizeUrl('https://x.io/a'));
  assert.equal(normalizeUrl(''), '');
  assert.equal(escapeLike('50%_off\\'), '50\\%\\_off\\\\');
});

// --- phases ----------------------------------------------------------------

test('phase ids and labels', () => {
  assert.equal(PHASES.length, 9);
  assert.equal(PHASE_LABELS.draft, 'Not sent');
  assert.equal(PHASE_LABELS.applied, 'Sent');
  assert.equal(PHASE_LABELS.screening, 'In process');
  assert.equal(isSent('draft'), false);
  assert.equal(isSent('skipped'), false);
  assert.equal(isSent('rejected'), true);
  assert.deepEqual(LIST_GROUPS.map((g) => g.id), ['interviews', 'waiting', 'not_sent', 'closed', 'older']);
  assert.equal(phaseGroup('offer'), 'interviews');
  assert.equal(phaseGroup('screening'), 'waiting');
  assert.equal(phaseGroup('skipped'), 'closed');
  assert.deepEqual(BOARD_COLUMNS.map((c) => c.label), ['Not sent', 'Sent', 'In process', 'Interviewing', 'Offer', 'Closed']);
  assert.equal(boardColumnOf('no_reply'), 'closed');
  assert.equal(BOARD_COLUMNS.find((c) => c.id === 'closed').dropPhase, null);
});

test('legacy maps mirror the SQL functions', () => {
  assert.equal(phaseFromLegacy('Not Applied', '-'), 'draft');
  assert.equal(phaseFromLegacy('Inactive', 'Technical Interview'), 'rejected');
  assert.equal(phaseFromLegacy('closed', null), 'rejected');
  assert.equal(phaseFromLegacy('Active', 'Final Round'), 'interviewing');
  assert.equal(phaseFromLegacy('Active', 'HR Interview'), 'interviewing');
  assert.equal(phaseFromLegacy('Active', 'Coding Assessment'), 'screening');
  assert.equal(phaseFromLegacy('Active', 'Screening'), 'applied');
  assert.equal(phaseFromLegacy(null, null), 'applied');
  assert.deepEqual(PHASES.map(legacyStatus),
    ['Not Applied', 'Active', 'Active', 'Active', 'Active', 'Inactive', 'Inactive', 'Inactive', 'Not Applied']);
  assert.equal(legacyStage('draft', 'Screening'), '-');
  assert.equal(legacyStage('applied', 'HR Interview'), 'Screening');
  assert.equal(legacyStage('screening', 'Coding Assessment'), 'Coding Assessment');
  assert.equal(legacyStage('screening', 'Final Round'), 'Screening');
  assert.equal(legacyStage('interviewing', 'HR Interview'), 'HR Interview');
  assert.equal(legacyStage('interviewing', 'Screening'), 'Video Interview');
  assert.equal(legacyStage('offer', null), 'Final Round');
  assert.equal(legacyStage('rejected', 'Technical Interview'), 'Technical Interview');
  assert.equal(legacyStage('no_reply', '-'), 'Screening');
  assert.equal(impliedPhase('applied', 'draft'), 'applied');
  assert.equal(impliedPhase('applied', 'interviewing'), null);
  assert.equal(impliedPhase('reply', 'applied'), 'screening');
  assert.equal(impliedPhase('reply', 'screening'), null);
  assert.equal(impliedPhase('interview_scheduled', 'screening'), 'interviewing');
  assert.equal(impliedPhase('rejection', 'interviewing'), 'rejected');
  assert.equal(impliedPhase('note', 'applied'), null);
  assert.equal(defaultDirection('interview_scheduled'), 'in');
  assert.equal(defaultDirection('follow_up_sent'), 'out');
  assert.equal(defaultDirection('auto_ack'), 'in');
  assert.equal(defaultDirection('posting_closed'), 'self');
  assert.equal(eventTitle({ kind: 'phase_change', to_phase: 'no_reply' }), 'Moved to No reply');
  assert.equal(eventTitle({ kind: 'reply', title: 'Recruiter call booked' }), 'Recruiter call booked');
});

test('phase colours: every phase has tokens and AA-contrast pairs', () => {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  for (const p of PHASES) {
    assert.deepEqual(PHASE_TOKENS[p], phaseTokens(p));
    for (const mode of ['light', 'dark']) {
      const { fg, bg } = PHASE_COLORS[p][mode];
      assert.ok(ratio(fg, bg) >= 4.5, `${p} ${mode} ${fg}/${bg} = ${ratio(fg, bg).toFixed(2)}`);
    }
  }
  for (const mode of ['light', 'dark']) assert.ok(ratio(CAUTION_COLORS[mode].fg, CAUTION_COLORS[mode].bg) >= 4.5);
  assert.deepEqual(phaseTokens('no_reply'), { fg: '--phase-no-reply-fg', bg: '--phase-no-reply-bg' });
});
