-- Launch-hardening persistence, RLS, storage scoping, and workflow automation.

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  title text not null,
  category text,
  status text not null default 'requested',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_title text not null,
  completed_at timestamptz not null default now(),
  unique (user_id, module_title)
);

create table if not exists public.student_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  token_hash text not null unique,
  status text not null default 'active',
  expires_at timestamptz not null default (now() + interval '14 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_requests_org_status on public.service_requests (organization_id, status, created_at desc);
create index if not exists idx_support_tickets_org_status on public.support_tickets (organization_id, status, created_at desc);
create index if not exists idx_training_progress_user on public.training_progress (user_id, completed_at desc);
create index if not exists idx_student_invites_student on public.student_invites (student_id, status, expires_at);
create unique index if not exists idx_tasks_application_open_title on public.tasks (application_id, title) where status = 'open';

alter table public.service_requests enable row level security;
alter table public.support_tickets enable row level security;
alter table public.training_progress enable row level security;
alter table public.student_invites enable row level security;

drop policy if exists "applications update through student" on public.applications;
create policy "applications update through student" on public.applications
for update using (
  exists (
    select 1 from public.students s
    where s.id = applications.student_id
      and public.can_access_student(s)
  )
  and (
    public.current_role() = 'admin'
    or applications.status in (
      'profile_incomplete',
      'documents_pending',
      'ready_for_admin_review',
      'pending_admin_review',
      'admin_changes_requested',
      'rejected'
    )
  )
) with check (
  exists (
    select 1 from public.students s
    where s.id = applications.student_id
      and public.can_access_student(s)
  )
  and (
    public.current_role() = 'admin'
    or status in (
      'profile_incomplete',
      'documents_pending',
      'ready_for_admin_review',
      'pending_admin_review',
      'admin_changes_requested',
      'rejected'
    )
  )
);

drop policy if exists "events created through application" on public.application_events;
create policy "events created through application" on public.application_events
for insert with check (
  actor_id = auth.uid()
  and exists (
    select 1
    from public.applications a
    join public.students s on s.id = a.student_id
    where a.id = application_events.application_id
      and public.can_access_student(s)
  )
);

drop policy if exists "tasks created through student" on public.tasks;
create policy "tasks created through student" on public.tasks
for insert with check (
  public.current_role() = 'admin'
  or exists (
    select 1
    from public.students s
    where s.id = tasks.student_id
      and public.can_access_student(s)
  )
);

drop policy if exists "audit created by signed users" on public.audit_events;
create policy "audit created by signed users" on public.audit_events
for insert with check (
  public.current_role() is not null
  and actor_id = auth.uid()
  and (
    public.current_role() = 'admin'
    or organization_id = public.current_org_id()
  )
);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
for update using (id = auth.uid())
with check (
  id = auth.uid()
  and organization_id = public.current_org_id()
  and role = public.current_role()
);

drop policy if exists "documents replaced by uploader" on public.documents;
create policy "documents replaced by uploader" on public.documents
for update using (
  uploaded_by = auth.uid()
  and exists (
    select 1 from public.students s
    where s.id = documents.student_id
      and public.can_access_student(s)
  )
) with check (
  uploaded_by = auth.uid()
  and status in ('uploaded', 'replaced')
  and exists (
    select 1 from public.students s
    where s.id = documents.student_id
      and public.can_access_student(s)
  )
);

drop policy if exists "managers cancel own account requests" on public.account_requests;
create policy "managers cancel own account requests" on public.account_requests
for update using (
  requested_by = auth.uid()
  and status in ('needs_auth_user', 'invited')
) with check (
  requested_by = auth.uid()
  and status = 'cancelled'
);

drop policy if exists "service requests visible by org" on public.service_requests;
create policy "service requests visible by org" on public.service_requests
for select using (
  public.current_role() = 'admin'
  or organization_id = public.current_org_id()
);

drop policy if exists "service requests created by org users" on public.service_requests;
create policy "service requests created by org users" on public.service_requests
for insert with check (
  requested_by = auth.uid()
  and (
    public.current_role() = 'admin'
    or organization_id = public.current_org_id()
  )
);

drop policy if exists "service requests updated by admin" on public.service_requests;
create policy "service requests updated by admin" on public.service_requests
for update using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "support tickets visible by org" on public.support_tickets;
create policy "support tickets visible by org" on public.support_tickets
for select using (
  public.current_role() = 'admin'
  or organization_id = public.current_org_id()
  or created_by = auth.uid()
);

drop policy if exists "support tickets created by org users" on public.support_tickets;
create policy "support tickets created by org users" on public.support_tickets
for insert with check (
  created_by = auth.uid()
  and (
    public.current_role() = 'admin'
    or organization_id = public.current_org_id()
  )
);

drop policy if exists "support tickets updated by admin" on public.support_tickets;
create policy "support tickets updated by admin" on public.support_tickets
for update using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "training progress visible by user or admin" on public.training_progress;
create policy "training progress visible by user or admin" on public.training_progress
for select using (
  public.current_role() = 'admin'
  or user_id = auth.uid()
  or organization_id = public.current_org_id()
);

drop policy if exists "training progress created by user" on public.training_progress;
create policy "training progress created by user" on public.training_progress
for insert with check (
  user_id = auth.uid()
  and organization_id = public.current_org_id()
);

drop policy if exists "training progress deleted by user" on public.training_progress;
create policy "training progress deleted by user" on public.training_progress
for delete using (user_id = auth.uid());

drop policy if exists "student invites visible through student" on public.student_invites;
create policy "student invites visible through student" on public.student_invites
for select using (
  public.current_role() = 'admin'
  or exists (
    select 1 from public.students s
    where s.id = student_invites.student_id
      and public.can_access_student(s)
  )
);

drop policy if exists "student invites created through student" on public.student_invites;
create policy "student invites created through student" on public.student_invites
for insert with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.students s
    where s.id = student_invites.student_id
      and public.can_access_student(s)
  )
);

drop policy if exists "student invites updated by creator or admin" on public.student_invites;
create policy "student invites updated by creator or admin" on public.student_invites
for update using (
  public.current_role() = 'admin'
  or created_by = auth.uid()
) with check (
  public.current_role() = 'admin'
  or created_by = auth.uid()
);

drop policy if exists "authenticated document object uploads" on storage.objects;
create policy "authenticated document object uploads" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'student-documents'
  and array_length(storage.foldername(name), 1) >= 2
  and exists (
    select 1
    from public.students s
    where s.organization_id::text = (storage.foldername(name))[1]
      and s.id::text = (storage.foldername(name))[2]
      and public.can_access_student(s)
  )
);

create or replace function public.ensure_application_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payout_currency text;
begin
  if new.status = 'deposit_paid'
    and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select pfp.payout_currency
      into payout_currency
    from public.partner_finance_profiles pfp
    where pfp.organization_id = new.organization_id
    limit 1;

    insert into public.commissions (
      organization_id,
      application_id,
      manager_id,
      expected_amount,
      currency,
      status,
      notes
    )
    values (
      new.organization_id,
      new.id,
      new.manager_id,
      0,
      coalesce(payout_currency, 'INR'),
      'projected',
      'Auto-created when deposit was marked paid.'
    )
    on conflict (application_id) do update
      set manager_id = excluded.manager_id,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_applications_auto_commission on public.applications;
create trigger trg_applications_auto_commission
after insert or update of status on public.applications
for each row execute function public.ensure_application_commission();

create or replace function public.ensure_application_task()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_title text;
  task_priority text := 'Medium';
  owner_id uuid;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  owner_id := coalesce(new.counselor_id, new.manager_id);

  if new.status = 'documents_pending' then
    task_title := 'Collect required documents';
    task_priority := 'High';
  elsif new.status in ('ready_for_admin_review', 'pending_admin_review') then
    task_title := 'Admin review required';
    task_priority := 'High';
  elsif new.status = 'offer_received' then
    task_title := 'Confirm offer and deposit plan';
    task_priority := 'High';
  elsif new.status = 'deposit_paid' then
    task_title := 'Prepare CAS/I-20/COE documents';
    task_priority := 'Medium';
  elsif new.status in ('cas_issued', 'visa_filed') then
    task_title := 'Track visa outcome';
    task_priority := 'Medium';
  else
    return new;
  end if;

  insert into public.tasks (
    organization_id,
    student_id,
    application_id,
    assigned_to,
    title,
    priority,
    due_date,
    status
  )
  values (
    new.organization_id,
    new.student_id,
    new.id,
    owner_id,
    task_title,
    task_priority,
    current_date + 3,
    'open'
  )
  on conflict do nothing;

  return new;
exception
  when invalid_column_reference then
    return new;
end;
$$;

drop trigger if exists trg_applications_auto_task on public.applications;
create trigger trg_applications_auto_task
after insert or update of status on public.applications
for each row execute function public.ensure_application_task();

do $$
begin
  alter publication supabase_realtime add table
    public.students,
    public.applications,
    public.documents,
    public.application_events,
    public.tasks,
    public.commissions,
    public.service_requests,
    public.support_tickets;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
