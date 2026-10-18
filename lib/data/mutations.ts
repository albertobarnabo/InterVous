'use client';
// Writes. Every write goes through RLS as the signed-in user, then refetches what is on screen.
// An update that matches 0 rows is an error (RLS hides rows instead of refusing them).
import type { Phase } from '../types';
import { currentUserId, db, must, toError } from './client';
import { todayIn } from './dates';
import { FIXTURE_MODE } from './env';
import { deriveOverview, fixtureInsertEvent, fixtureToday, loadFixture } from './fixture';
import { KEYS } from './queries';
import type {
    Application,
    GapState,
    JobAnswer,
    JobEvent,
    JobProofPoint,
    JobRequirement,
    JobRow,
    JobUpdate,
    NewEvent,
    ProofPoint,
    UserSettings,
} from './rows';
import { invalidateAll, patchCached, peekCached } from './store';

const BUCKET = 'intervous-docs';

function nothingUpdated(what: string): Error {
    return new Error(`No ${what} was updated. It may have been deleted, or you may not have access to it.`);
}

async function today(): Promise<string> {
    if (FIXTURE_MODE) return fixtureToday(await loadFixture());
    const s = peekCached<UserSettings>(KEYS.settings);
    return todayIn(s?.timezone ?? 'Europe/Berlin');
}

/** Optimistically patch the list rows of one job (the board and list re-group at once). */
function patchListRow(jobId: number, patch: Partial<Application>) {
    patchCached<Application[]>(KEYS.applications, (rows) => rows.map((r) => (r.id === jobId ? { ...r, ...patch } : r)));
}

async function updateOne<T>(table: string, match: Record<string, string | number>, patch: object, what: string): Promise<T> {
    let q = db.from(table).update(patch);
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const rows = must(await q.select()) as T[] | null;
    if (!rows?.length) throw nothingUpdated(what);
    return rows[0];
}

// ── applications ────────────────────────────────────────────────────────────

/**
 * Update columns of one `jobs` row. Throws when 0 rows were updated.
 * Writing `phase` directly makes the database log an automatic phase_change event;
 * prefer movePhase() for user-visible moves (it records the date and note).
 */
export async function updateApplication(jobId: number, patch: JobUpdate): Promise<JobRow> {
    patchListRow(jobId, patch as Partial<Application>);
    try {
        if (FIXTURE_MODE) {
            const f = await loadFixture();
            const job = f.jobs.find((j) => j.id === jobId);
            if (!job) throw nothingUpdated('application');
            const prev = job.phase;
            Object.assign(job, patch, { updated_at: new Date().toISOString() });
            if ('phase' in patch && patch.phase !== prev) {
                fixtureInsertEvent(f, { job_id: jobId, kind: 'phase_change', from_phase: prev, to_phase: patch.phase as Phase, source: 'auto' });
            }
            deriveOverview(f, jobId);
            return { ...job };
        }
        return await updateOne<JobRow>('jobs', { id: jobId }, patch, 'application');
    } finally {
        void invalidateAll();
    }
}

const deletedJobs = new Set<number>();

/**
 * True when this page deleted the application. The dossier uses it to show "Deleted" instead of
 * "No application at this address" while it navigates away.
 */
export function wasDeleted(jobId: number | null | undefined): boolean {
    return jobId != null && deletedJobs.has(Number(jobId));
}

/** Permanently delete an application and (by cascade) its events, documents, answers and fit items. */
export async function deleteApplication(jobId: number): Promise<void> {
    if (FIXTURE_MODE) {
        const f = await loadFixture();
        f.jobs = f.jobs.filter((j) => j.id !== jobId);
        f.apps = f.apps.filter((a) => a.id !== jobId);
        f.events = f.events.filter((e) => e.job_id !== jobId);
    } else {
        const rows = must(await db.from('jobs').delete().eq('id', jobId).select('id')) as { id: number }[] | null;
        if (!rows?.length) throw new Error('No application was deleted. It may already be gone.');
    }
    deletedJobs.add(Number(jobId));
    patchCached<Application[]>(KEYS.applications, (rows) => rows.filter((r) => r.id !== jobId));
    await invalidateAll();
}

// ── events ──────────────────────────────────────────────────────────────────

/**
 * Add a timeline event. The database fills to_phase/direction from the kind and moves the
 * phase unless a newer phase-bearing event exists. Returns the stored row.
 */
export async function logEvent(jobId: number, input: NewEvent): Promise<JobEvent> {
    const occurred_on = input.occurred_on ?? (await today());
    try {
        if (FIXTURE_MODE) {
            return fixtureInsertEvent(await loadFixture(), { ...input, job_id: jobId, occurred_on, source: 'web' } as Parameters<typeof fixtureInsertEvent>[1]);
        }
        const row = { ...input, job_id: jobId, occurred_on, source: 'web' };
        return must(await db.from('job_events').insert(row).select().single()) as JobEvent;
    } finally {
        void invalidateAll();
    }
}

/** Delete one timeline event (the phase is not changed). */
export async function deleteEvent(eventId: number): Promise<void> {
    if (FIXTURE_MODE) {
        const f = await loadFixture();
        const ev = f.events.find((e) => e.id === eventId);
        f.events = f.events.filter((e) => e.id !== eventId);
        if (ev) deriveOverview(f, ev.job_id);
    } else {
        const rows = must(await db.from('job_events').delete().eq('id', eventId).select('id')) as { id: number }[] | null;
        if (!rows?.length) throw new Error('No event was deleted. It may already be gone.');
    }
    await invalidateAll();
}

export type MoveResult = {
    event: JobEvent;
    from: Phase | null;
    to: Phase;
    /** False when a newer phase-bearing event kept the phase where it was. */
    moved: boolean;
    /** Deletes the event and restores the previous phase, leaving no trace in the timeline. */
    undo: () => Promise<void>;
};

/**
 * Move an application to a phase by inserting a `phase_change` event with to_phase set
 * (the database moves the phase). `on` defaults to today; `note` becomes the event body.
 */
export async function movePhase(jobId: number, to: Phase, opts: { on?: string; note?: string | null } = {}): Promise<MoveResult> {
    const list = peekCached<Application[]>(KEYS.applications);
    const cached = list?.find((a) => a.id === jobId);
    let from: Phase | null | undefined = cached ? ((cached.phase as Phase | null) ?? null) : undefined;
    if (from === undefined) {
        if (FIXTURE_MODE) from = ((await loadFixture()).jobs.find((j) => j.id === jobId)?.phase as Phase | null) ?? null;
        else from = ((must(await db.from('jobs').select('phase').eq('id', jobId).maybeSingle()) as { phase: Phase | null } | null)?.phase) ?? null;
    }
    patchListRow(jobId, { phase: to } as Partial<Application>);

    let event: JobEvent;
    try {
        event = await logEvent(jobId, { kind: 'phase_change', to_phase: to, occurred_on: opts.on, body: opts.note ?? null });
    } catch (e) {
        patchListRow(jobId, { phase: from } as Partial<Application>);
        throw toError(e);
    }

    let now: Phase | null;
    if (FIXTURE_MODE) now = ((await loadFixture()).jobs.find((j) => j.id === jobId)?.phase as Phase | null) ?? null;
    else now = ((must(await db.from('jobs').select('phase').eq('id', jobId).maybeSingle()) as { phase: Phase | null } | null)?.phase) ?? null;
    const moved = now === to && from !== to;

    const undo = async () => {
        patchListRow(jobId, { phase: from } as Partial<Application>);
        if (FIXTURE_MODE) {
            const f = await loadFixture();
            f.events = f.events.filter((e) => e.id !== event.id);
            const job = f.jobs.find((j) => j.id === jobId);
            if (job && moved) job.phase = from as JobRow['phase'];
            deriveOverview(f, jobId);
            await invalidateAll();
            return;
        }
        must(await db.from('job_events').delete().eq('id', event.id));
        if (moved) {
            await updateOne<JobRow>('jobs', { id: jobId }, { phase: from }, 'application');
            // The direct phase edit logged an automatic phase_change; remove it so Undo leaves no trace.
            const auto = must(
                await db
                    .from('job_events')
                    .select('id')
                    .eq('job_id', jobId)
                    .eq('kind', 'phase_change')
                    .eq('source', 'auto')
                    .eq('to_phase', from as string)
                    .order('id', { ascending: false })
                    .limit(1),
            ) as { id: number }[] | null;
            if (auto?.length) must(await db.from('job_events').delete().eq('id', auto[0].id));
        }
        await invalidateAll();
    };

    return { event, from: from ?? null, to, moved, undo };
}

type JobState = { phase: Phase | null; applied_on: string | null; uncertain: string[] };

async function jobState(jobId: number): Promise<JobState> {
    if (FIXTURE_MODE) {
        const j = (await loadFixture()).jobs.find((x) => x.id === jobId);
        if (!j) throw nothingUpdated('application');
        return { phase: (j.phase as Phase | null) ?? null, applied_on: j.applied_on ?? null, uncertain: [...((j.uncertain ?? []) as string[])] };
    }
    const j = must(await db.from('jobs').select('phase,applied_on,uncertain').eq('id', jobId).maybeSingle()) as
        | { phase: Phase | null; applied_on: string | null; uncertain: string[] | null }
        | null;
    if (!j) throw nothingUpdated('application');
    return { phase: j.phase ?? null, applied_on: j.applied_on ?? null, uncertain: [...(j.uncertain ?? [])] };
}

export type RecordResult = {
    events: JobEvent[];
    from: Phase | null;
    /** The phase after the write. */
    to: Phase | null;
    /** Deletes the new events and puts phase, applied_on and uncertain back, leaving no trace. */
    undo: () => Promise<void>;
};

/**
 * One "what happened" update of an application, undoable as a whole:
 *   events   inserted in order (the database moves the phase and fills applied_on, as for logEvent)
 *   patch    jobs columns written after them (e.g. applied_on for a corrected sent date)
 *   confirm  fields the user just stated, removed from jobs.uncertain
 */
export async function recordUpdate(
    jobId: number,
    input: { events?: NewEvent[]; patch?: Pick<JobUpdate, 'applied_on'>; confirm?: string[] },
): Promise<RecordResult> {
    const before = await jobState(jobId);
    const events: JobEvent[] = [];
    try {
        for (const ev of input.events ?? []) events.push(await logEvent(jobId, ev));
        const patch: JobUpdate = { ...(input.patch ?? {}) };
        const left = before.uncertain.filter((f) => !(input.confirm ?? []).includes(f));
        if (left.length !== before.uncertain.length) patch.uncertain = left;
        if (Object.keys(patch).length) await updateApplication(jobId, patch);
    } catch (e) {
        for (const ev of events) await deleteEvent(ev.id).catch(() => undefined);
        throw toError(e);
    }
    const after = await jobState(jobId);

    const undo = async () => {
        const restore: JobUpdate = {};
        if (after.phase !== before.phase) restore.phase = before.phase as JobUpdate['phase'];
        if (after.applied_on !== before.applied_on) restore.applied_on = before.applied_on;
        if (after.uncertain.join() !== before.uncertain.join()) restore.uncertain = before.uncertain;
        patchListRow(jobId, { phase: before.phase } as Partial<Application>);
        if (FIXTURE_MODE) {
            const f = await loadFixture();
            const ids = new Set(events.map((e) => e.id));
            f.events = f.events.filter((e) => !ids.has(e.id));
            const job = f.jobs.find((j) => j.id === jobId);
            if (job) Object.assign(job, restore);
            deriveOverview(f, jobId);
            await invalidateAll();
            return;
        }
        for (const ev of events) must(await db.from('job_events').delete().eq('id', ev.id));
        if (Object.keys(restore).length) {
            await updateOne<JobRow>('jobs', { id: jobId }, restore, 'application');
            if ('phase' in restore) {
                // The direct phase edit logged an automatic phase_change; remove it so Undo leaves no trace.
                const auto = must(
                    await db
                        .from('job_events')
                        .select('id')
                        .eq('job_id', jobId)
                        .eq('kind', 'phase_change')
                        .eq('source', 'auto')
                        .eq('to_phase', before.phase as string)
                        .order('id', { ascending: false })
                        .limit(1),
                ) as { id: number }[] | null;
                if (auto?.length) must(await db.from('job_events').delete().eq('id', auto[0].id));
            }
        }
        await invalidateAll();
    };

    return { events, from: before.phase, to: after.phase, undo };
}

// ── child rows edited from the web ──────────────────────────────────────────

/** Edit a fit item (gap_state chip, evidence, note). */
export async function updateRequirement(
    id: string,
    patch: Partial<Pick<JobRequirement, 'gap_state' | 'evidence' | 'note' | 'verdict' | 'topic' | 'anchor_text'>> & { gap_state?: GapState | null },
): Promise<JobRequirement> {
    try {
        if (FIXTURE_MODE) {
            const f = await loadFixture();
            const r = f.requirements.find((x) => x.id === id);
            if (!r) throw nothingUpdated('fit item');
            Object.assign(r, patch);
            deriveOverview(f, r.job_id);
            return { ...r };
        }
        return await updateOne<JobRequirement>('job_requirements', { id }, patch, 'fit item');
    } finally {
        void invalidateAll();
    }
}

/** Edit an answer ("Paste it" for answers given in chat but never saved). */
export async function updateAnswer(
    id: string,
    patch: Partial<Pick<JobAnswer, 'answer' | 'question' | 'char_limit' | 'submitted' | 'source_path'>>,
): Promise<JobAnswer> {
    try {
        if (FIXTURE_MODE) {
            const f = await loadFixture();
            const a = f.answers.find((x) => x.id === id);
            if (!a) throw nothingUpdated('answer');
            Object.assign(a, patch, { updated_at: new Date().toISOString() });
            deriveOverview(f, a.job_id);
            return { ...a };
        }
        return await updateOne<JobAnswer>('job_answers', { id }, patch, 'answer');
    } finally {
        void invalidateAll();
    }
}

/** Edit a proof point (metric, metric_status, caveat; facts are merged by the caller). */
export async function updateProofPoint(
    id: string,
    patch: Partial<Pick<ProofPoint, 'name' | 'summary' | 'metric' | 'facts' | 'metric_status' | 'caveat' | 'link' | 'aliases'>>,
): Promise<ProofPoint> {
    try {
        if (FIXTURE_MODE) {
            const f = await loadFixture();
            const p = f.proofPoints.find((x) => x.id === id);
            if (!p) throw nothingUpdated('proof point');
            Object.assign(p, patch, { updated_at: new Date().toISOString() });
            return { ...p };
        }
        return await updateOne<ProofPoint>('proof_points', { id }, patch, 'proof point');
    } finally {
        void invalidateAll();
    }
}

/** Edit how one application worded a proof point. */
export async function updateJobProofPoint(jobId: number, proofPointId: string, patch: Partial<Pick<JobProofPoint, 'detail' | 'position'>>): Promise<JobProofPoint> {
    try {
        if (FIXTURE_MODE) {
            const f = await loadFixture();
            const p = f.jobProofPoints.find((x) => x.job_id === jobId && x.proof_point_id === proofPointId);
            if (!p) throw nothingUpdated('proof point use');
            Object.assign(p, patch);
            return { ...p };
        }
        return await updateOne<JobProofPoint>('job_proof_points', { job_id: jobId, proof_point_id: proofPointId }, patch, 'proof point use');
    } finally {
        void invalidateAll();
    }
}

/** Save thresholds (creates the user_settings row on first save). */
export async function updateSettings(
    patch: Partial<Omit<UserSettings, 'user_id' | 'updated_at'>>,
): Promise<UserSettings> {
    try {
        if (FIXTURE_MODE) {
            const f = await loadFixture();
            Object.assign(f.settings, patch);
            return { ...f.settings };
        }
        const uid = await currentUserId();
        if (!uid) throw new Error('You are signed out. Sign in again to save settings.');
        return must(await db.from('user_settings').upsert({ ...patch, user_id: uid }, { onConflict: 'user_id' }).select().single()) as UserSettings;
    } finally {
        void invalidateAll();
    }
}

// ── storage ─────────────────────────────────────────────────────────────────

/**
 * A 10-minute signed URL for a file in the private `intervous-docs` bucket
 * (job_documents.storage_path). Returns null in fixture mode, where no files exist.
 */
export async function signedUrl(path: string, opts: { expiresIn?: number; download?: string | boolean } = {}): Promise<string | null> {
    if (FIXTURE_MODE) return null;
    const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(path, opts.expiresIn ?? 600, opts.download ? { download: opts.download } : undefined);
    if (error) throw toError(error);
    return data?.signedUrl ?? null;
}

/** Refetch everything that is on screen now. */
export function refetchAll(): Promise<void> {
    return invalidateAll();
}
