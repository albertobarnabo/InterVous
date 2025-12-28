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
}