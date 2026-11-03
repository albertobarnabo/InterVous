// node --test: the 5-second window of useUndoableDelete, the only protection a row with no dialog has.
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import './support.mjs';

globalThis.window = new EventTarget();

const { currentState, unmount } = await import('./fakeReact.mjs');
const { resetFakes, shown } = await import('./fakeUi.mjs');
const { useUndoableDelete } = await import('../../../src/features/applications/useUndoableDelete.ts');

const WINDOW = 5000;
const settle = () => new Promise((r) => setImmediate(r));
const hidden = () => [...currentState()].sort();
const undoToast = () => shown.toasts.find((t) => t.action);

function key(init, target) {
    const e = new Event('keydown', { cancelable: true });
    Object.assign(e, { key: 'z', metaKey: false, ctrlKey: false, shiftKey: false, ...init });
    if (target) Object.defineProperty(e, 'target', { value: target });
    return e;
}

beforeEach(() => {
    resetFakes();
    mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
});

afterEach(() => {
    unmount();
    mock.timers.reset();
});

test('a row leaves at once and nothing is written during the window', () => {
    const { remove } = useUndoableDelete();
    remove(1, 'Acme');
    assert.deepEqual(hidden(), [1]);
    assert.equal(undoToast().text, 'Deleted Acme.');
    mock.timers.tick(WINDOW - 1);
    assert.equal(shown.deletes.length, 0);
});

test('Undo writes nothing and brings the rows back', async () => {
    const { remove } = useUndoableDelete();
    const restored = [];
    remove(1, 'Acme', { onUndo: (ids) => restored.push(...ids) });
    mock.timers.tick(1000);
    undoToast().action.run();
    assert.deepEqual(hidden(), []);
    assert.deepEqual(restored, [1]);
    mock.timers.tick(WINDOW * 2);
    await settle();
    assert.equal(shown.deletes.length, 0);
});

test('a run of deletes shares one toast and one write, however long the run', async () => {
    const { remove } = useUndoableDelete();
    for (const id of [1, 2, 3, 4, 5]) {
        remove(id, `Company ${id}`);
        mock.timers.tick(WINDOW - 1);
    }
    assert.equal(shown.deletes.length, 0, 'each delete restarts the window');
    assert.equal(shown.toasts.length, 1);
    assert.equal(undoToast().text, '5 applications deleted.');
    mock.timers.tick(1);
    await settle();
    assert.deepEqual(shown.deletes, [{ ids: [1, 2, 3, 4, 5], opts: { onlyUnsent: true } }]);
    assert.deepEqual(hidden(), []);
    assert.equal(shown.toasts.length, 0);
});

test('Undo brings back the whole run', () => {
    const { remove } = useUndoableDelete();
    remove(1, 'Acme');
    remove(2, 'Globex');
    undoToast().action.run();
    assert.deepEqual(hidden(), []);
});

test('rows stay hidden while the write runs', async () => {
    const { remove } = useUndoableDelete();
    remove(1, 'Acme');
    mock.timers.tick(WINDOW);
    assert.deepEqual(hidden(), [1]);
    await settle();
    assert.deepEqual(hidden(), []);
});

test('a click straight after a delete is too soon, and then it is not', () => {
    const { remove, tooSoon } = useUndoableDelete();
    assert.equal(tooSoon(), false);
    remove(1, 'Acme');
    assert.equal(tooSoon(), true);
    mock.timers.tick(399);
    assert.equal(tooSoon(), true);
    mock.timers.tick(1);
    assert.equal(tooSoon(), false);
});

test('a failed write brings the rows back and says so', async () => {
    const { remove } = useUndoableDelete();
    shown.nextDelete = new Error('network down');
    remove(1, 'Acme');
    mock.timers.tick(WINDOW);
    await settle();
    assert.deepEqual(hidden(), []);
    assert.equal(shown.toasts[0].kind, 'error');
    assert.match(shown.toasts[0].text, /^Not deleted: network down/);
});

test('rows that stayed are named, whether some or all', async () => {
    const { remove } = useUndoableDelete();
    shown.nextDelete = { deleted: 1, filesLeft: 0, filesUnchecked: 0 };
    remove(1, 'Acme');
    remove(2, 'Globex');
    mock.timers.tick(WINDOW);
    await settle();
    assert.match(shown.toasts[0].text, /^1 of 2 deleted\./);

    resetFakes();
    shown.nextDelete = { deleted: 0, filesLeft: 0, filesUnchecked: 0 };
    remove(3, 'Initech');
    mock.timers.tick(WINDOW);
    await settle();
    assert.match(shown.toasts[0].text, /^Nothing was deleted\./);
});

test('files left behind are reported', async () => {
    const { remove } = useUndoableDelete();
    shown.nextDelete = { deleted: 1, filesLeft: 2, filesUnchecked: 0 };
    remove(1, 'Acme');
    mock.timers.tick(WINDOW);
    await settle();
    assert.equal(shown.toasts[0].kind, 'error');
    assert.match(shown.toasts[0].text, /2 stored files/);
});

test('leaving the page writes at once', async () => {
    const { remove } = useUndoableDelete();
    remove(1, 'Acme');
    unmount();
    await settle();
    assert.deepEqual(shown.deletes.map((d) => d.ids), [[1]]);
    assert.equal(shown.toasts.length, 0);
});

test('hiding the tab writes nothing', async () => {
    const { remove } = useUndoableDelete();
    remove(1, 'Acme');
    window.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));
    await settle();
    assert.equal(shown.deletes.length, 0);
});

test('the browser asks before closing the tab only while a delete is waiting', () => {
    const { remove } = useUndoableDelete();
    const leave = () => {
        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
    };
    assert.equal(leave(), false);
    remove(1, 'Acme');
    assert.equal(leave(), true);
    undoToast().action.run();
    assert.equal(leave(), false);
});

test('⌘Z or Ctrl+Z undoes, and the keyboard is told about it', async () => {
    const { remove } = useUndoableDelete();
    remove(1, 'Acme', { byKeyboard: true });
    assert.equal(undoToast().text, 'Deleted Acme. ⌘Z to undo.');
    const e = key({ metaKey: true });
    window.dispatchEvent(e);
    assert.equal(e.defaultPrevented, true);
    assert.deepEqual(hidden(), []);
    assert.equal(shown.toasts.length, 0);

    remove(2, 'Globex');
    window.dispatchEvent(key({ ctrlKey: true, key: 'Z' }));
    assert.deepEqual(hidden(), []);
    mock.timers.tick(WINDOW);
    await settle();
    assert.equal(shown.deletes.length, 0);
});

test('⌘Z leaves text fields, other keys and an empty window alone', () => {
    const { remove } = useUndoableDelete();
    const idle = key({ metaKey: true });
    window.dispatchEvent(idle);
    assert.equal(idle.defaultPrevented, false, 'nothing is waiting');

    remove(1, 'Acme');
    const typing = key({ metaKey: true }, { closest: () => ({}) });
    window.dispatchEvent(typing);
    assert.equal(typing.defaultPrevented, false);
    window.dispatchEvent(key({}));
    window.dispatchEvent(key({ metaKey: true, shiftKey: true }));
    assert.deepEqual(hidden(), [1]);
});
