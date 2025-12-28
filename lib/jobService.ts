import { JobEntry } from './types';
import { supabase } from './supbaseClient';

export async function getJobsByUser(userId: string) {
    const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', userId)
        .order('application_date', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
}

export async function createJob(job: Omit<JobEntry, 'id'>) {

    const { data, error } = await supabase
        .from('jobs')
        .insert([job])
        .select();

    if (error) throw new Error(error.message);
    return data[0];
}

export async function deleteJob(jobId: number, userId: string) {
    const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('user_id', userId);

    if (error) throw new Error(error.message);
}

export async function updateJob(job: JobEntry, userId: string) {
    const { data, error } = await supabase
        .from('jobs')
        .update({
            company_name: job.company_name,
            role: job.role,
            location: job.location,
            application_date: job.application_date,
            status: job.status,
            stage: job.stage,
            url: job.url,
        })
        .eq('id', job.id)
        .eq('user_id', userId) // required for RLS
        .select();

    if (error) throw new Error(error.message);
    return data[0];
}


