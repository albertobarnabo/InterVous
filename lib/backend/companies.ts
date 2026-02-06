
import { supabase } from '../supbaseClient';
import { Company, CompanyTag, CompanyWithTags } from '../types';

export async function getCompanies(): Promise<CompanyWithTags[]> {
    const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('*')
        .order('name');

    if (companiesError) throw new Error(companiesError.message);

    const { data: tagMaps, error: tagMapsError } = await supabase
        .from('company_tag_map')
        .select('company_id, tag_id, company_tags(id, name, description)');

    if (tagMapsError) throw new Error(tagMapsError.message);

    const companiesWithTags = companies.map((company) => {
        const tags = tagMaps
            .filter((map) => map.company_id === company.id)
            .map((map) => map.company_tags) as unknown as CompanyTag[];
        
        // Remove duplicates just in case
        const uniqueTags = Array.from(new Map(tags.map(tag => [tag.id, tag])).values());

        return {
            ...company,
            tags: uniqueTags,
        };
    });

    return companiesWithTags;
}

export async function createCompany(company: Omit<Company, 'id' | 'created_by'>, tagIds: string[], userId: string): Promise<CompanyWithTags> {
    const { data: newCompany, error: createError } = await supabase
        .from('companies')
        .insert([{ ...company, created_by: userId }])
        .select()
        .single();

    if (createError) throw new Error(createError.message);

    if (tagIds.length > 0) {
        const tagMaps = tagIds.map(tagId => ({
            company_id: newCompany.id,
            tag_id: tagId,
        }));

        const { error: tagError } = await supabase
            .from('company_tag_map')
            .insert(tagMaps);

        if (tagError) throw new Error(tagError.message);
    }

    // Fetch the created company with tags to return consistent data
    // For simplicity, we can just construct it since we know the tags
    // But fetching tags details is safer if we only have IDs.
    
    // minimal return for now, full fetch might be better but let's see usage
    // optimize by fetching only the tags we just added
    const { data: tagsData, error: tagsFetchError } = await supabase
        .from('company_tags')
        .select('*')
        .in('id', tagIds);
        
    if (tagsFetchError) throw new Error(tagsFetchError.message);

    return {
        ...newCompany,
        tags: tagsData || []
    };
}

export async function getCompanyTags(): Promise<CompanyTag[]> {
    const { data, error } = await supabase
        .from('company_tags')
        .select('*')
        .order('name');

    if (error) throw new Error(error.message);
    return data;
}

export async function createCompanyTag(name: string, description: string | null): Promise<CompanyTag> {
     const { data, error } = await supabase
        .from('company_tags')
        .insert([{ name, description }])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateCompany(id: string, company: Partial<Omit<Company, 'id' | 'created_by'>>, tagIds: string[]): Promise<void> {
    // 1. Update company details
    const { error: updateError } = await supabase
        .from('companies')
        .update(company)
        .eq('id', id);

    if (updateError) throw new Error(updateError.message);

    // 2. Sync tags
    if (tagIds) {
        // First delete existing mappings
        const { error: deleteError } = await supabase
            .from('company_tag_map')
            .delete()
            .eq('company_id', id);

        if (deleteError) throw new Error(deleteError.message);

        // Then insert new mappings
        if (tagIds.length > 0) {
            // We need the user ID for created_by. For now, we'll try to get it from auth.getUser() or pass it in.
            // Since we are in a server/client mixed context, let's rely on the RLS or pass it if needed.
            // But wait, the previous createCompany took userId. 
            // Ideally we should pass userId here too, or fetch it.
            // Let's fetch current user to be safe if not passed, although typically we might just utilize RLS defaults if set up.
            // However, company_tag_map likely requires created_by.
            
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated for tag update");

            const tagMaps = tagIds.map(tagId => ({
                company_id: id,
                tag_id: tagId,
            }));

            const { error: insertError } = await supabase
                .from('company_tag_map')
                .insert(tagMaps);

            if (insertError) throw new Error(insertError.message);
        }
    }
}
