import { ApiKeys } from './types';
import { supabase } from './supbaseClient';

export async function getKeysByUser(userId: string): Promise<ApiKeys | null> {
    const { data, error } = await supabase
        .from('keys')
        .select('*')
        .eq('user_id', userId)

    if (error) throw new Error(error.message);
    return data[0];
}

export async function setApiKeys(userId: string, keys: ApiKeys) {
    // upsert: creates the row on first save instead of silently updating nothing
    const { data, error } = await supabase
        .from('keys')
        .upsert(
            {
                user_id: userId,
                open_ai: keys.open_ai,
                deep_seek: keys.deep_seek,
                mistral: keys.mistral,
                tavily: keys.tavily,
            },
            { onConflict: 'user_id' }
        )
        .select();

    if (error) throw new Error(error.message);
    return data[0];
}
