import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHome, summarySentence, joinNames, HOME_MAX_ACTIONS } from '../home.mjs';
import { buildContext } from '../derive.mjs';
import { buildToday } from '../today.mjs';
import { confirmBatches } from '../home.mjs';

const fx = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(fx);

test('summary sentence and tiles count every application by status', () => {
  const h = buildHome(fx);
  assert.equal(h.summary, '11 applications are waiting for a reply and 1 is at interview stage.');
  assert.deepEqual(h.tiles.map((t) => [t.id, t.label, t.count]), [
    ['waiting', 'Waiting for a reply', 11],
    ['interviews', 'Interviews', 1],
    ['not_sent', 'Not sent yet', 6],
    ['closed', 'Closed', 5],
  ]);
  assert.equal(h.tiles.reduce((s, t) => s + t.count, 0), fx.apps.length);
});

test('summary sentence wording', () => {
  assert.equal(summarySentence({ waiting: 1, interviewing: 0, offers: 0, notSent: 0, total: 1 }), '1 application is waiting for a reply.');
  assert.equal(summarySentence({ waiting: 0, interviewing: 2, offers: 0, notSent: 0, total: 2 }), '2 applications are at interview stage.');
  assert.equal(summarySentence({ waiting: 3, interviewing: 1, offers: 1, notSent: 0, total: 5 }),
    '3 applications are waiting for a reply, 1 is at interview stage and you have an offer.');
  assert.equal(summarySentence({ waiting: 0, interviewing: 0, offers: 0, notSent: 2, total: 2 }), 'Nothing is waiting for a reply. 2 CVs are ready to send.');
  assert.equal(summarySentence({ waiting: 0, interviewing: 0, offers: 0, notSent: 0, total: 0 }), 'No applications yet. Add a job to get started.');
  assert.equal(joinNames(['Apple', 'Meta', 'OpenAI']), 'Apple, Meta and OpenAI');
});

test('"Do this now": three plain cards, one button each, in Today order', () => {
  const h = buildHome(fx);
  assert.equal(h.actions.length, HOME_MAX_ACTIONS);
  assert.deepEqual(h.actions.map((a) => [a.text, a.button.label]), [
    ['Tell us how your Apple interview went. Nothing has been noted for 38 days.', 'Update'],
    ['Did you send the 5 CVs made in October? Confirm them so replies can be tracked.', 'Confirm'],
    ["European Central Bank hasn't replied in 16 days. A short follow-up can help.", 'Copy follow-up'],
  ]);
  assert.equal(h.more, 4);
  assert.equal(h.empty, false);
  // no internal words reach the sentences
  for (const a of h.actions) assert.doesNotMatch(a.text, /phase|unconfirmed|facts|proof point|visa|role family|channel/i);
});

test('the confirm item is asked in small batches, newest CVs first', () => {
  const ctx = buildContext(fx);
  const item = buildToday(fx).items.find((it) => it.type === 'confirm_facts');
  const batches = confirmBatches(item.questions, ctx);
  assert.deepEqual(batches.map((b) => [b.key, b.apps.length]), [
    ['confirm_facts:drafts:2026-10', 5],
    ['confirm_facts:drafts:2026-09', 1],
    ['confirm_facts:sent', 9],
    ['confirm_facts:other', 1],
  ]);
  // every question lands in exactly one batch
  assert.equal(batches.reduce((s, b) => s + b.questions.length, 0), item.questions.length);
  assert.deepEqual(batches[0].apps.map((a) => a.company).sort(), ['Databricks', 'Mistral AI', 'NVIDIA', 'OpenAI', 'Revolut']);
});

test('"Not now" hides a card and the next one takes its place', () => {
  const first = buildHome(fx);
  const h = buildHome(fx, { dismissed: { [first.actions[1].key]: '2026-10-19' } });
  assert.equal(h.actions[1].key, 'confirm_facts:drafts:2026-09');
  assert.match(h.actions[1].text, /^Did you send the Unnamed Frankfurt .* CV made in September\?/);
  assert.deepEqual(h.hiddenKeys, ['confirm_facts:drafts:2026-10']);
  // an expired "Not now" no longer hides it
  const back = buildHome(fx, { dismissed: { [first.actions[1].key]: '2026-10-16' } });
  assert.equal(back.actions[1].key, first.actions[1].key);
});

test('the other Home sentences', () => {
  const h = buildHome(fx, {
    dismissed: { 'outcome_missing:128': '9999-12-31', 'follow_up:135': '9999-12-31', 'confirm_facts:drafts:2026-10': '9999-12-31',
      'confirm_facts:drafts:2026-09': '9999-12-31', 'confirm_facts:sent': '9999-12-31', 'confirm_facts:other': '9999-12-31' },
  });
  assert.deepEqual(h.actions.map((a) => [a.text, a.button.id]), [
    ["Anthropic, Cohere, G-Research, LangChain and OpenAI haven't replied in 48 days. They are probably closed.", 'mark_no_reply'],
    ['The OpenAI job post is gone and your CV was never sent. Take it off your list?', 'drop'],
    ['Your CV for Unnamed Frankfurt wealth & asset manager (via AI Futures) has been ready for 32 days. Send it while the job is still open.', 'mark_sent'],
  ]);
  assert.equal(h.actions[1].link?.label, 'See the newer post');
});

test('nothing to do', () => {
  const f = clone();
  f.apps = [];
  const h = buildHome(f);
  assert.equal(h.empty, true);
  assert.equal(h.emptyLine, 'Nothing to do today.');
  assert.equal(h.summary, 'No applications yet. Add a job to get started.');
  assert.deepEqual(h.learned, []);
});

test('"What we\'ve learned so far": counts, never a percentage below 20', () => {
  const h = buildHome(fx);
  assert.deepEqual(h.learned.map((l) => l.text), [
    '1 of 6 older applications got a reply (Apple).',
    '7 job posts asked for more years of experience.',
    '5 applications have had no reply for 45+ days and are probably closed.',
  ]);
  for (const l of h.learned) assert.doesNotMatch(l.text, /%/);
});
