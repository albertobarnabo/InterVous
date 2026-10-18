// The one browser Supabase client (lib/supbaseClient.ts), re-exported for lib/data.
// Results are cast to the row types in ./rows (from lib/database.types.ts) at each call site;
// the client itself is left untyped so a hand-written Database type cannot turn columns into `never`.
import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeLike } from '../core';
import { supabase } from '../supbaseClient';

export const db: SupabaseClient = supabase;

/** Turns a PostgrestError / StorageError / unknown into an Error with a readable message. */
export function toError(e: unknown, fallback = 'Something went wrong'): Error {
    if (e instanceof Error) return e;
    if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
        const err = new Error((e as { message: string }).message);
        const code = (e as { code?: unknown }).code;
        if (typeof code === 'string') (err as Error & { code?: string }).code = code;
        return err;
    }
    return new Error(fallback);
}

/** Throws when a Supabase response carries an error; returns its data otherwise. */
export function must<T>(res: { data: T; error: unknown }): T {
    if (res.error) throw toError(res.error);
    return res.data;
}

export async function currentUserId(): Promise<string | null> {
    const { data } = await db.auth.getSession();
    return data.session?.user.id ?? null;
}

/**
 * Text for a PostgREST like/ilike pattern that matches literally: % _ and \ are escaped
 * (lib/core escapeLike), and * (which PostgREST reads as %) becomes the one-character wildcard _.
 * Add your own % around it. Escape exactly once.
 */
export function likeLiteral(s: string): string {
    return escapeLike(s).replace(/\*/g, '_');
}

const PAGE = 500;

/** Reads every row with .range() in 500-row pages (no silent 1000-row truncation). */
export async function fetchAll<T>(
    page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
        const rows = must(await page(from, from + PAGE - 1)) as T[] | null;
        if (!rows?.length) break;
        out.push(...rows);
        if (rows.length < PAGE) break;
    }
    return out;
}
