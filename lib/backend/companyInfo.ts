import { supabase } from '../supbaseClient';
import { CompanyInfo } from '../types';

export async function getCompanyInfo(companyId: string): Promise<CompanyInfo | null> {
    const { data, error } = await supabase
        .from('company_info')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
}

export async function upsertCompanyInfo(
    info: Omit<CompanyInfo, 'updated_at' | 'updated_by'>,
    userId: string
): Promise<CompanyInfo> {
    const { data, error } = await supabase
        .from('company_info')
        .upsert(
            {
                ...info,
                updated_at: new Date().toISOString(),
                updated_by: userId,
            },
            { onConflict: 'company_id' }
        )
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}
