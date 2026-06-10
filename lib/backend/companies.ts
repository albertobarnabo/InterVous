
import { supabase } from '../supbaseClient';
import { Company, CompanyTag, CompanyWithTags, SortOption } from '../types';

export async function getCompanies(
    page: number = 1,
    pageSize: number = 20,
    searchQuery: string = '',
    tagId: string | null = null,
    sortBy: SortOption = 'name_asc',
    letter: string | null = null
): Promise<{ data: CompanyWithTags[]; count: number }> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
        .from('companies')
        .select('*', { count: 'exact' });

    if (tagId) {
        // Filter by tag using an inner join on the junction table
        query = supabase
            .from('companies')
            // Using !inner ensures we only get companies that have a matching record in company_tag_map
            .select('*, company_tag_map!inner(tag_id)', { count: 'exact' })
            .eq('company_tag_map.tag_id', tagId);
    }

    if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
    }

    if (letter) {
        query = query.ilike('name', `${letter}%`);
    }

    // 'shuffle' orders by uuid: effectively random but stable, so pages never repeat
    const orderColumn = sortBy === 'recent' ? 'created_at' : sortBy === 'shuffle' ? 'id' : 'name';
    const ascending = sortBy !== 'name_desc';

    const { data: companies, error, count } = await query
        .order(orderColumn, { ascending })
        .range(from, to);

    if (error) throw new Error(error.message);

    if (!companies || companies.length === 0) {
        return { data: [], count: count || 0 };
    }

    const companyIds = companies.map((c) => c.id);

    const { data: tagMaps, error: tagMapsError } = await supabase
        .from('company_tag_map')
        .select('company_id, tag_id, company_tags(id, name, description)')
        .in('company_id', companyIds);

    if (tagMapsError) throw new Error(tagMapsError.message);

    const companiesWithTags = companies.map((company) => {
        const tags = tagMaps
            .filter((map) => map.company_id === company.id)
            .map((map) => map.company_tags) as unknown as CompanyTag[];

        // Remove duplicates just in case
        const uniqueTags = Array.from(new Map(tags.map((tag) => [tag.id, tag])).values());
        
        // Clean up internal join property if it exists
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { company_tag_map, ...cleanCompany } = company as unknown as { company_tag_map: unknown } & CompanyWithTags;

        return {
            ...cleanCompany,
            tags: uniqueTags,
        };
    });

    return { data: companiesWithTags, count: count || 0 };
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

export async function updateCompanyTag(id: string, name: string): Promise<CompanyTag> {
    const { data, error } = await supabase
        .from('company_tags')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteCompanyTag(id: string): Promise<void> {
    // Remove assignments first so the FK constraint doesn't block the delete
    const { error: mapError } = await supabase
        .from('company_tag_map')
        .delete()
        .eq('tag_id', id);

    if (mapError) throw new Error(mapError.message);

    const { error } = await supabase
        .from('company_tags')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
}

export async function getCompanyByName(name: string): Promise<CompanyWithTags | null> {
    const { data: company, error } = await supabase
        .from('companies')
        .select('*')
        .eq('name', name)
        .maybeSingle();

    if (error) throw new Error(error.message);
    if (!company) return null;

    const { data: tagMaps, error: tagError } = await supabase
        .from('company_tag_map')
        .select('tag_id, company_tags(id, name, description)')
        .eq('company_id', company.id);

    if (tagError) throw new Error(tagError.message);

    const tags = (tagMaps || []).map((m) => m.company_tags) as unknown as CompanyTag[];
    return { ...company, tags };
}

export async function getAllCompanyNames(): Promise<string[]> {
    const { data, error } = await supabase
        .from('companies')
        .select('name');

    if (error) throw new Error(error.message);
    return (data || []).map((r) => r.name);
}

export async function getJobCountsByCompanyNames(
    companyNames: string[],
    userId: string
): Promise<Record<string, number>> {
    if (companyNames.length === 0) return {};

    const { data, error } = await supabase
        .from('jobs')
        .select('company_name')
        .eq('user_id', userId)
        .in('company_name', companyNames);

    if (error) throw new Error(error.message);

    const counts: Record<string, number> = {};
    for (const row of data || []) {
        counts[row.company_name] = (counts[row.company_name] || 0) + 1;
    }
    return counts;
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
