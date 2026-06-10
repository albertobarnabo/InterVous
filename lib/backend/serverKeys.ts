import { createClient } from '@supabase/supabase-js';
import { ApiKeys } from '../types';

/* Server-side helper for API routes: authenticates the caller from the
   Authorization header and reads their API keys directly from Supabase,
   so key values never travel through the browser. RLS still applies
   because the client is created with the user's own access token. */
export async function getUserAndKeys(
    request: Request
): Promise<{ userId: string; keys: ApiKeys | null } | null> {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return null;

    const { data, error } = await supabase
        .from('keys')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return { userId: user.id, keys: data };
}
