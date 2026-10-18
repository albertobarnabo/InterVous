'use client';
// Resolve now, write in 5 seconds (spec 2.1: "Resolving a row collapses it and shows a 5-second Undo
// toast instead of a confirm dialog"). The row hides at once; Undo inside the window cancels the write,
// so nothing reaches the database and the timeline keeps no trace. When the window closes the write
// runs; leaving the page or hiding the tab runs every pending write immediately.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { refetchAll } from '../../../lib/data';
import { useToast } from '@/ui';

export const UNDO_MS = 5000;

type Pending = { timer: ReturnType<typeof setTimeout>; commit: () => Promise<unknown>; toastId: number };

export type DeferInput = {
    /** What disappears (a Today item key, an entry id, a question key). */
    id: string;
    /** Toast text, e.g. "Marked OpenAI as no reply". */
    text: ReactNode;
    /** The write. Runs after the Undo window, or at once on leave. */
    commit: () => Promise<unknown>;
    /** Called when Undo restores the item. */
    onUndo?: () => void;
};

function message(e: unknown): string {
    return e instanceof Error ? e.message : 'Something went wrong';
}

export function useDeferred() {
    const toast = useToast();
    const pending = useRef(new Map<string, Pending>());
    /** ids hidden on screen: pending, or written and waiting for the refetch */
    const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

    const unhide = useCallback((id: string) => {
        setHidden((s) => {
            if (!s.has(id)) return s;
            const n = new Set(s);
            n.delete(id);
            return n;
        });
    }, []);

    const run = useCallback(
        async (id: string) => {
            const p = pending.current.get(id);
            if (!p) return;
            pending.current.delete(id);
            clearTimeout(p.timer);
            // once the write runs, Undo can no longer cancel it: take the toast down with it
            toast.dismiss(p.toastId);
            try {
                await p.commit();
                await refetchAll();
            } catch (e) {
                toast.show({ kind: 'error', text: `Not saved: ${message(e)}` });
            } finally {
                unhide(id);
            }
        },
        [toast, unhide],
    );

    const defer = useCallback(
        ({ id, text, commit, onUndo }: DeferInput) => {
            const prev = pending.current.get(id);
            if (prev) clearTimeout(prev.timer);
            setHidden((s) => new Set(s).add(id));
            const toastId = toast.show({
                kind: 'success',
                text,
                duration: UNDO_MS,
                action: {
                    label: 'Undo',
                    run: () => {
                        const p = pending.current.get(id);
                        if (!p) return;
                        clearTimeout(p.timer);
                        pending.current.delete(id);
                        unhide(id);
                        onUndo?.();
                    },
                },
            });
            const timer = setTimeout(() => void run(id), UNDO_MS);
            pending.current.set(id, { timer, commit, toastId });
        },
        [run, toast, unhide],
    );

    /** Run every pending write now (leaving the page, hiding the tab, closing the confirm flow). */
    const flush = useCallback(() => {
        for (const id of [...pending.current.keys()]) void run(id);
    }, [run]);

    useEffect(() => {
        const onHide = () => {
            if (document.visibilityState === 'hidden') flush();
        };
        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('pagehide', flush);
        const map = pending.current;
        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('pagehide', flush);
            // unmount (route change): write what is pending, without touching unmounted state
            for (const [id, p] of map) {
                clearTimeout(p.timer);
                map.delete(id);
                toast.dismiss(p.toastId);
                void p.commit().then(
                    () => refetchAll(),
                    (e) => toast.show({ kind: 'error', text: `Not saved: ${message(e)}` }),
                );
            }
        };
    }, [flush, toast]);

    return { defer, hidden, flush, isPending: (id: string) => pending.current.has(id) };
}
