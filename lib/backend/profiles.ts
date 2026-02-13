
import { supabase } from '../supbaseClient';

export interface Profile {
    id: string;
    avatar_url: string | null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
    
    return data;
}

export async function getProfileAvatar(userId: string): Promise<string | null> {
    const profile = await getProfile(userId);
    return profile?.avatar_url ?? null;
}

export async function updateProfileAvatar(userId: string, avatarUrl: string | null): Promise<void> {
    const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);

    if (error) {
        throw error;
    }
}
