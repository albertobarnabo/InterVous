export type JobEntry = {
    id: number;
    company_name: string;
    role: string;
    location: string;
    application_date: string | null;
    status: string;
    stage: string;
    user_id: string;
    url: string;
};

export type ApiKeys = {
    user_id: string;
    open_ai: string;
    deep_seek: string;
    mistral: string;
    tavily: string;
}

export type CompanyInfo = {
    company_id: string;
    description: string | null;
    industry: string | null;
    headquarters: string | null;
    founded: string | null;
    employee_count: string | null;
    updated_at?: string;
    updated_by?: string | null;
};

export type Company = {
    id: string;
    name: string;
    website: string | null;
    logo_url: string | null;
    created_by: string;
};

export type CompanyTag = {
    id: string;
    name: string;
    description: string | null;
};

export type CompanyTagMap = {
    company_id: string;
    tag_id: string;
    created_by: string;
};

export type CompanyWithTags = Company & {
    tags: CompanyTag[];
    job_count?: number;
};

export type SortOption = 'name_asc' | 'name_desc' | 'recent' | 'shuffle';