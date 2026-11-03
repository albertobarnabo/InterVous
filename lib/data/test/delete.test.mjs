// node --test: deleteApplications against an in-memory database, and which rows may skip the dialog.
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import './support.mjs';

const { reset, state } = await import('./fakeClient.mjs');
const { deleteApplication, deleteApplications, wasDeleted } = await import('../mutations.ts');
const { deleteWarning, isDisposable, leftoverText } = await import('../../../src/features/applications/model.ts');

const job = (id, slug = `job${id}`, phase = 'draft') => ({ id, slug, phase });
const clean = (deleted, filesLeft = 0, filesUnchecked = 0) => ({ deleted, filesLeft, filesUnchecked });
const doc = (job_id, storage_path) => ({ job_id, storage_path });

beforeEach(() => reset());

test('the rows are read before the delete, and the files removed after it', async () => {
    reset({ jobs: [job(1)], job_documents: [doc(1, 'u1/job1/cv_pdf/a-cv.pdf')] }, ['u1/job1/cv_pdf/a-cv.pdf']);
    assert.deepEqual(await deleteApplication(1), clean(1));
    assert.equal(state.tables.jobs.length, 0);
    assert.equal(state.objects.size, 0);
    const { log } = state;
    assert.ok(log.indexOf('select job_documents') < log.indexOf('delete jobs'));
    assert.ok(log.indexOf('delete jobs') < log.findIndex((l) => l.startsWith('remove ')));
    assert.ok(wasDeleted(1));
});

test('a job with no stored files makes no remove call', async () => {
    reset({ jobs: [job(1)] });
    assert.deepEqual(await deleteApplication(1), clean(1));
    assert.ok(!state.log.some((l) => l.startsWith('remove ')));
});

test('a file in the job folder with no row goes too; another job keeps what it still names', async () => {
    const orphan = 'u1/job1/cv_pdf/old-cv.pdf';
    const shared = 'u1/job1/cv_pdf/shared.pdf';
    reset(
        { jobs: [job(1), job(2)], job_documents: [doc(1, shared), doc(2, shared)] },
        [orphan, shared, 'u1/job2/cv_pdf/b-cv.pdf'],
    );
    assert.deepEqual(await deleteApplication(1), clean(1));
    assert.deepEqual([...state.objects].sort(), ['u1/job1/cv_pdf/shared.pdf', 'u1/job2/cv_pdf/b-cv.pdf']);
});

test('a job with no slug uses its job-<id> folder', async () => {
    reset({ jobs: [job(7, null)] }, ['u1/job-7/other/x.txt']);
    await deleteApplication(7);
    assert.equal(state.objects.size, 0);
});

test('a batch is one delete statement and removes every file', async () => {
    reset({ jobs: [job(1), job(2), job(3)] }, ['u1/job1/other/a', 'u1/job2/other/b', 'u1/job3/other/c']);
    assert.deepEqual(await deleteApplications([1, 2]), clean(2));
    assert.deepEqual(state.tables.jobs.map((j) => j.id), [3]);
    assert.deepEqual([...state.objects], ['u1/job3/other/c']);
    assert.equal(state.log.filter((l) => l === 'delete jobs').length, 1);
});

test('files of a job that was not deleted stay', async () => {
    reset({ jobs: [job(1)], job_documents: [doc(9, 'u1/job9/other/z')] }, ['u1/job1/other/a', 'u1/job9/other/z']);
    assert.deepEqual(await deleteApplications([1, 9]), clean(1));
    assert.deepEqual([...state.objects], ['u1/job9/other/z']);
});

test('a remove the policy refuses is reported, and the application stays deleted', async () => {
    reset({ jobs: [job(1)], job_documents: [doc(1, 'u1/job1/other/a')] }, ['u1/job1/other/a', 'u1/job1/other/b']);
    state.refused.add('u1/job1/other/a');
    assert.deepEqual(await deleteApplication(1), clean(1, 1));
    assert.equal(state.tables.jobs.length, 0);
});

test('a storage failure is reported, not thrown', async () => {
    reset({ jobs: [job(1)], job_documents: [doc(1, 'u1/job1/other/a')] }, ['u1/job1/other/a']);
    state.failRemove = 'storage down';
    assert.deepEqual(await deleteApplication(1), clean(1, 1));
    assert.equal(state.tables.jobs.length, 0);
});

test('a failed folder listing does not stop the delete, and is reported', async () => {
    reset({ jobs: [job(1)], job_documents: [doc(1, 'u1/job1/other/a')] }, ['u1/job1/other/a', 'u1/job1/other/no-row']);
    state.failList = 'list refused';
    assert.deepEqual(await deleteApplication(1), clean(1, 0, 1));
    assert.deepEqual([...state.objects], ['u1/job1/other/no-row']);
});

test('a path that was never stored is not reported as left behind', async () => {
    reset({ jobs: [job(1)], job_documents: [doc(1, 'u1/job1/other/never-uploaded')] });
    assert.deepEqual(await deleteApplication(1), clean(1));
});

test('two jobs in a batch naming one file count it once', async () => {
    reset({ jobs: [job(1), job(2)], job_documents: [doc(1, 'u1/shared/x'), doc(2, 'u1/shared/x')] }, ['u1/shared/x']);
    assert.deepEqual(await deleteApplications([1, 2]), clean(2));
    assert.equal(state.objects.size, 0);
});

test('onlyUnsent keeps a job sent since the row was deleted, and its files', async () => {
    reset(
        { jobs: [job(1), job(2, 'job2', 'applied'), job(3, 'job3', null), job(4, 'job4', 'skipped')], job_documents: [doc(2, 'u1/job2/cv_pdf/cv.pdf')] },
        ['u1/job2/cv_pdf/cv.pdf'],
    );
    assert.deepEqual(await deleteApplications([1, 2, 3, 4], { onlyUnsent: true }), clean(3));
    assert.deepEqual(state.tables.jobs.map((j) => j.id), [2]);
    assert.deepEqual([...state.objects], ['u1/job2/cv_pdf/cv.pdf']);
});

test('without onlyUnsent a sent job is deleted: its dialog already asked', async () => {
    reset({ jobs: [job(2, 'job2', 'applied')] });
    assert.deepEqual(await deleteApplication(2), clean(1));
});

test('a batch that deleted nothing reports it instead of throwing', async () => {
    reset({ jobs: [] });
    assert.deepEqual(await deleteApplications([1, 2]), clean(0));
});

test('when the file rows cannot be read nothing is deleted', async () => {
    reset({ jobs: [job(1)], job_documents: [doc(1, 'u1/job1/other/a')] }, ['u1/job1/other/a']);
    state.failRead = 'read failed';
    await assert.rejects(deleteApplication(1), /read failed/);
    assert.equal(state.tables.jobs.length, 1);
    assert.equal(state.objects.size, 1);
});

test('when the delete fails no file is touched', async () => {
    reset({ jobs: [job(1)], job_documents: [doc(1, 'u1/job1/other/a')] }, ['u1/job1/other/a']);
    state.failDelete = 'not allowed';
    await assert.rejects(deleteApplication(1), /not allowed/);
    assert.equal(state.objects.size, 1);
    assert.ok(!state.log.some((l) => l.startsWith('remove ')));
});

test('a job already gone is an error with no file removed', async () => {
    reset({ jobs: [] });
    await assert.rejects(deleteApplication(1), /already be gone/);
});

test('only rows with nothing to lose skip the dialog', () => {
    const row = ({ sent = false, statusUnconfirmed = false, has_cv = false, cvBuiltOn = null, answer_count = 0, events = [] } = {}) => ({
        app: { has_cv, answer_count },
        d: { sent, statusUnconfirmed, cvBuiltOn, events },
    });
    assert.equal(isDisposable(row()), true);
    assert.equal(isDisposable(row({ has_cv: null, answer_count: null })), true);
    assert.equal(isDisposable(row({ events: [{ kind: 'note' }] })), true, "an agent's found job has one note");
    assert.equal(isDisposable(row({ events: [{ kind: 'note' }, { kind: 'phase_change' }, { kind: 'skipped' }] })), true);
    assert.equal(isDisposable(row({ sent: true })), false);
    assert.equal(isDisposable(row({ statusUnconfirmed: true })), false, 'the app is still asking whether it was sent');
    assert.equal(isDisposable(row({ has_cv: true })), false);
    assert.equal(isDisposable(row({ cvBuiltOn: '2026-10-01' })), false);
    assert.equal(isDisposable(row({ answer_count: 5 })), false);
    assert.equal(isDisposable(row({ events: [{ kind: 'reply' }] })), false);
});

test('the warning names the row, and the numbers only when it counts in them', () => {
    const sent = deleteWarning({ company: 'Acme', role: 'Engineer', d: { sent: true, cvBuiltOn: null } });
    assert.equal(sent, 'Acme · Engineer. Its history, CV and notes are deleted too. It also stops counting in your numbers. This cannot be undone.');
    assert.match(deleteWarning({ company: 'Acme', role: 'Engineer', d: { sent: false, cvBuiltOn: '2026-10-01' } }), /numbers/);
    assert.doesNotMatch(deleteWarning({ company: 'Acme', role: 'Engineer', d: { sent: false, cvBuiltOn: null } }), /numbers/);
});

test('leftovers are named only when there are some', () => {
    assert.equal(leftoverText(clean(1)), null);
    assert.match(leftoverText(clean(1, 1)), /1 stored file could/);
    assert.match(leftoverText(clean(1, 2)), /2 stored files could/);
    assert.match(leftoverText(clean(1, 0, 1)), /could not be checked/);
});
