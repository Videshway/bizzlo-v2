-- Data rights support for exports and anonymized deletion workflows.

create table if not exists public.data_erasure_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  student_id uuid,
  target_type text not null check (target_type in ('student', 'organization')),
  target_id uuid not null,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'completed' check (status in ('completed', 'failed')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.data_erasure_events enable row level security;

drop policy if exists "data erasure visible to admins" on public.data_erasure_events;
create policy "data erasure visible to admins" on public.data_erasure_events
for select using (public.current_role() = 'admin');

drop policy if exists "data erasure inserted by admins" on public.data_erasure_events;
create policy "data erasure inserted by admins" on public.data_erasure_events
for insert with check (public.current_role() = 'admin');

create index if not exists idx_data_erasure_org_created
  on public.data_erasure_events (organization_id, created_at desc);

