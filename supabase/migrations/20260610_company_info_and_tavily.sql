-- Run this in the Supabase SQL editor (Dashboard > SQL Editor > New query)

-- 1. Tavily API key column on the existing keys table
alter table public.keys add column if not exists tavily text;

-- 2. Company info table: one row of enrichment data per company
create table if not exists public.company_info (
    company_id uuid primary key references public.companies(id) on delete cascade,
    description text,
    industry text,
    headquarters text,
    founded text,
    employee_count text,
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id)
);

alter table public.company_info enable row level security;

-- Same collaborative model as companies: any signed-in user can read and edit
create policy "Authenticated users can read company info"
    on public.company_info for select
    to authenticated
    using (true);

create policy "Authenticated users can insert company info"
    on public.company_info for insert
    to authenticated
    with check (true);

create policy "Authenticated users can update company info"
    on public.company_info for update
    to authenticated
    using (true);
