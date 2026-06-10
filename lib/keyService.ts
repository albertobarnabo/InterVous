import { supabase } from './supbaseClient';

export type KeyField = 'open_ai' | 'deep_seek' | 'mistral' | 'tavily';

export type KeysStatus = Record<KeyField, boolean>;

/* Which keys are configured (booleans only) — values never reach the browser */
export async function getKeysStatus(): Promise<KeysStatus | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const res = await fetch('/intervous/api/keys-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return null;
    return res.json();
}

/* Write-only: saves the fields the user typed; empty fields are left unchanged */
export async function setApiKeys(
    userId: string,
    keys: Partial<Record<KeyField, string>>
): Promise<void> {
    const updates: Record<string, string> = {};
    for (const [field, value] of Object.entries(keys)) {
        if (value && value.trim()) updates[field] = value.trim();
    }
    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
        .from('keys')
        .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });

    if (error) throw new Error(error.message);
}
