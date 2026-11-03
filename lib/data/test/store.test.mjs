// node --test: a read that started before a write must not undo that write.
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import './support.mjs';

// Not called useResource here: outside a render these are plain calls, and invalidateAll waits for
// every entry on screen, so each test takes its own off screen when it ends.
const { invalidateAll, patchCached, peekCached, useResource: resource } = await import('../store.ts');
const { leaveScreen } = await import('./fakeReact.mjs');

afterEach(leaveScreen);

/** A fetcher whose reads the test finishes by hand, in any order. */
function manualFetcher() {
    const reads = [];
    const fetcher = () =>
        new Promise((resolve, reject) => {
            reads.push({ resolve, reject });
        });
    return { fetcher, reads };
}

const settle = () => new Promise((r) => setImmediate(r));

async function loaded(key, data) {
    const m = manualFetcher();
    const r = resource(key, m.fetcher);
    m.reads[0].resolve(data);
    await settle();
    assert.deepEqual(peekCached(key), data);
    return { ...m, refetch: r.refetch };
}

test('a read in flight when a row is deleted cannot put the row back', async () => {
    const { reads, refetch } = await loaded('race', ['a', 'b']);
    void refetch(); // read 2 starts, before the delete
    patchCached('race', (rows) => rows.filter((x) => x !== 'a'));
    let done = false;
    const fresh = invalidateAll().then(() => (done = true));
    reads[1].resolve(['a', 'b']); // read 2 lands, from before the delete
    await settle();
    assert.deepEqual(peekCached('race'), ['b'], 'the stale read was thrown away');
    assert.equal(done, false, 'still waiting for data read after the delete');
    assert.equal(reads.length, 3);
    reads[2].resolve(['b']);
    await fresh;
    assert.deepEqual(peekCached('race'), ['b']);
});

test('a failed read from before the write leaves no error behind', async () => {
    const { reads, refetch } = await loaded('race-error', ['a']);
    void refetch();
    patchCached('race-error', (rows) => rows);
    const fresh = invalidateAll();
    reads[1].reject(new Error('old read failed'));
    await settle();
    reads[2].resolve(['b']);
    await fresh;
    assert.deepEqual(peekCached('race-error'), ['b']);
    assert.equal(resource('race-error', () => Promise.resolve(['b'])).error, null);
});

test('with nothing on screen yet, the first read is shown even if it was invalidated', async () => {
    const m = manualFetcher();
    resource('first', m.fetcher);
    const fresh = invalidateAll();
    m.reads[0].resolve(['old']);
    await settle();
    assert.deepEqual(peekCached('first'), ['old']);
    m.reads[1].resolve(['new']);
    await fresh;
    assert.deepEqual(peekCached('first'), ['new']);
});

test('without a read in flight an invalidation reads once', async () => {
    const { reads } = await loaded('calm', ['a']);
    const fresh = invalidateAll();
    assert.equal(reads.length, 2);
    reads[1].resolve(['b']);
    await fresh;
    assert.deepEqual(peekCached('calm'), ['b']);
    assert.equal(reads.length, 2);
});

test('an invalidation off screen is not lost to a read in flight', async () => {
    const m = manualFetcher();
    const r = resource('offscreen', m.fetcher);
    m.reads[0].resolve(['a']);
    await settle();
    void r.refetch();
    leaveScreen();
    patchCached('offscreen', (rows) => [...rows, 'patched']);
    const fresh = invalidateAll();
    m.reads[1].resolve(['old']);
    await settle();
    assert.deepEqual(peekCached('offscreen'), ['a', 'patched'], 'the old read was not written');
    m.reads[2].resolve(['new']);
    await fresh;
    await settle();
    assert.deepEqual(peekCached('offscreen'), ['new']);
});

test('invalidations alone never hold data back, and an await covers one read after it', async () => {
    const { reads } = await loaded('busy', ['v0']);
    let done = false;
    const first = invalidateAll();
    const second = invalidateAll().then(() => (done = true));
    reads[1].resolve(['v1']); // landed with an invalidation pending, as during an agent's import
    await settle();
    assert.deepEqual(peekCached('busy'), ['v1'], 'written, not thrown away');
    assert.equal(done, false, 'the await still needs a read that started after it');
    const third = invalidateAll();
    reads[2].resolve(['v2']); // landed with another invalidation pending
    await settle();
    assert.deepEqual(peekCached('busy'), ['v2']);
    await first;
    await second;
    assert.equal(done, true, 'it does not wait for later reads');
    reads[3].resolve(['v3']);
    await third;
    assert.deepEqual(peekCached('busy'), ['v3']);
});
