
import { supabase } from '../supbaseClient';

const BUCKET_NAME = 'user_avatars';

export async function uploadAvatar(userId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
            upsert: true
        });

    if (uploadError) {
        throw uploadError;
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return data.publicUrl;
}

export async function deleteAvatar(url: string): Promise<void> {
    try {
        // Extract the file path from the public URL
        // URL format: .../storage/v1/object/public/user_avatars/userId/filename
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split(`/${BUCKET_NAME}/`);
        
        if (pathParts.length < 2) return; // Invalid URL format for this bucket
        
        const filePath = pathParts[1];

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (error) {
            console.error('Error removing old avatar:', error);
            // We don't throw here to avoid blocking the main flow if cleanup fails
        }
    } catch (e) {
        console.error('Error parsing avatar URL for deletion:', e);
    }
}
