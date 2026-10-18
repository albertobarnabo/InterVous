'use client';
// "Not now" for Home's cards: per viewer, in localStorage under iv.today.dismissed as
// {actionKey: untilISO}. buildHome(input, {dismissed}) hides a card while until >= today.
// Every access is wrapped: the page works the same without storage (private window, blocked site data).
import { useCallback, useEffect, useState } from 'react';
import { addDays } from '../../../lib/core';

const KEY = 'iv.today.dismissed';
/** "Not relevant" never comes back for the same item key (a new key, e.g. a new date, does). */
export const FOREVER = '9999-12-31';
/** Snooze 3 days: hidden today and the next two days, back on the third. */
export const SNOOZE_DAYS = 3;

export type Dismissed = Record<string, string>;

function read(): Dismissed {
    try {
        const raw = window.localStorage.getItem(KEY);
        const v = raw ? (JSON.parse(raw) as unknown) : null;
        if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
        const out: Dismissed = {};
        for (const [k, until] of Object.entries(v as Record<string, unknown>)) {
            if (typeof until === 'string' && /^\d{4}-\d{2}-\d{2}/.test(until)) out[k] = until;
        }
        return out;
    } catch {
        return {};
    }
}

function write(d: Dismissed) {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
        /* storage unavailable: keep the in-memory value for this visit */
    }
}

/** Last day an item snoozed today stays hidden. */
export function snoozeUntil(today: string): string {
    return addDays(today, SNOOZE_DAYS - 1);
}

export function useDismissed(today: string | null) {
    const [dismissed, setDismissed] = useState<Dismissed>({});

    useEffect(() => {
        const d = read();
        // drop entries that have run out
        if (today) {
            let changed = false;
            for (const [k, until] of Object.entries(d)) {
                if (until.slice(0, 10) < today) {
                    delete d[k];
                    changed = true;
                }
            }
            if (changed) write(d);
        }
        setDismissed(d);
    }, [today]);

    const set = useCallback((key: string, until: string | null) => {
        setDismissed((prev) => {
            const next = { ...prev };
            if (until) next[key] = until;
            else delete next[key];
            write(next);
            return next;
        });
    }, []);

    const clearAll = useCallback(() => {
        setDismissed({});
        write({});
    }, []);

    return { dismissed, set, clearAll };
}
