'use client';
// A small keyed cache with stale-while-revalidate, shared by every lib/data hook.
// Live updates: refetch when the tab becomes visible again, and on Supabase Realtime
// changes to jobs, job_events and job_documents (debounced). Started on first use.
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { db, toError } from './client';
import { FIXTURE_MODE } from './env';

export type Resource<T> = {
    data: T | undefined;
    error: Error | null;
    /** True on the first load (no data yet). */
    loading: boolean;
    /** True while refetching with data already shown. */
    refreshing: boolean;
};

export type ResourceResult<T> = Resource<T> & { refetch: () => Promise<void> };

type Entry = {
    state: Resource<unknown>;
    fetcher: () => Promise<unknown>;
    listeners: Set<() => void>;
    inflight: Promise<void> | null;
    dirty: boolean;
    stale: boolean;
    fetchedAt: number;
};

const IDLE: Resource<never> = { data: undefined, error: null, loading: true, refreshing: false };
const DISABLED: Resource<never> = { data: undefined, error: null, loading: false, refreshing: false };
const entries = new Map<string, Entry>();

function notify(e: Entry) {
    for (const l of e.listeners) l();
}

function run(e: Entry): Promise<void> {
    if (e.inflight) {
        e.dirty = true;
        return e.inflight;
    }
    const hasData = e.state.data !== undefined;
    e.state = { ...e.state, loading: !hasData, refreshing: hasData };
    notify(e);
    e.inflight = e
        .fetcher()
        .then(
            (data) => {
                e.state = { data, error: null, loading: false, refreshing: false };
                e.fetchedAt = Date.now();
                e.stale = false;
            },
            (err) => {
                e.state = { ...e.state, error: toError(err), loading: false, refreshing: false };
            },
        )
        .finally(() => {
            e.inflight = null;
            notify(e);
            if (e.dirty) {
                e.dirty = false;
                void run(e);
            }
        });
    return e.inflight;
}

function entry(key: string, fetcher: () => Promise<unknown>): Entry {
    let e = entries.get(key);
    if (!e) {
        e = { state: IDLE, fetcher, listeners: new Set(), inflight: null, dirty: false, stale: true, fetchedAt: 0 };
        entries.set(key, e);
    }
    return e;
}

/** Refetch every resource that is on screen; mark the rest stale. Resolves when the visible ones are done. */
export function invalidateAll(): Promise<void> {
    const pending: Promise<void>[] = [];
    for (const e of entries.values()) {
        e.stale = true;
        if (e.listeners.size) pending.push(run(e));
    }
    return Promise.all(pending).then(() => undefined);
}

/** Drop everything (sign-out). */
export function clearCache() {
    for (const e of entries.values()) {
        e.state = IDLE;
        e.stale = true;
        notify(e);
    }
}

/** Change cached data in place (optimistic updates). The updater gets the current value of each matching key. */
export function patchCached<T>(keyPrefix: string, update: (data: T) => T) {
    for (const [k, e] of entries) {
        if (!k.startsWith(keyPrefix) || e.state.data === undefined) continue;
        e.state = { ...e.state, data: update(e.state.data as T) };
        notify(e);
    }
}

/** Read cached data without subscribing. */
export function peekCached<T>(key: string): T | undefined {
    return entries.get(key)?.state.data as T | undefined;
}

/**
 * Subscribe to a cached resource. `key` null disables it. Data older than 30s is revalidated on mount.
 * The fetcher may change between renders; the latest one is used.
 */
export function useResource<T>(key: string | null, fetcher: () => Promise<T>): ResourceResult<T> {
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const e = key ? entry(key, () => fetcherRef.current()) : null;
    if (e) e.fetcher = () => fetcherRef.current();

    const state = useSyncExternalStore(
        (cb) => {
            if (!e) return () => {};
            e.listeners.add(cb);
            return () => e.listeners.delete(cb);
        },
        () => (e ? e.state : DISABLED),
        () => (e ? IDLE : DISABLED),
    ) as Resource<T>;

    useEffect(() => {
        if (!e) return;
        startLive();
        if (!e.inflight && (e.stale || e.state.data === undefined || Date.now() - e.fetchedAt > 30_000)) void run(e);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `e` is derived from `key`
    }, [key]);

    return { ...state, refetch: () => (e ? run(e) : Promise.resolve()) };
}

// ── live updates ────────────────────────────────────────────────────────────

let live = false;
let channel: RealtimeChannel | null = null;
let channelUid: string | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null;
let lastVisibleRefetch = 0;

function soon() {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
        debounce = null;
        void invalidateAll();
    }, 300);
}

async function subscribeRealtime() {
    if (FIXTURE_MODE) return;
    const { data } = await db.auth.getSession();
    const uid = data.session?.user.id ?? null;
    if (channel && channelUid === uid) return;
    if (channel) {
        void db.removeChannel(channel);
        channel = null;
    }
    channelUid = uid;
    if (!uid) return;
    const filter = `user_id=eq.${uid}`;
    channel = db.channel(`intervous-live-${uid}`);
    for (const table of ['jobs', 'job_events', 'job_documents']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, soon);
    }
    channel.subscribe();
}

/** Idempotent: wires visibilitychange and Realtime once per page load. */
export function startLive() {
    if (live || typeof window === 'undefined') return;
    live = true;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const now = Date.now();
        if (now - lastVisibleRefetch < 2000) return;
        lastVisibleRefetch = now;
        void invalidateAll();
    });
    window.addEventListener('online', soon);
    if (!FIXTURE_MODE) {
        void subscribeRealtime();
        db.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                clearCache();
                if (channel) void db.removeChannel(channel);
                channel = null;
                channelUid = null;
            } else if (event === 'SIGNED_IN') {
                void subscribeRealtime();
            }
        });
    }
}
