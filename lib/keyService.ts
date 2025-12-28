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
    const { data, error } = await supabase
        .from('keys')
        .update({
            open_ai: keys.open_ai,
            deep_seek: keys.deep_seek
        })
        .eq('user_id', userId)
        .select();

    if (error) throw new Error(error.message);
    return data[0];
}