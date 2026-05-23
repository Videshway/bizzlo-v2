-- Scan contract, audit validation/redaction, organization guardrails, and invite visibility.

alter table public.documents
  add column if not exists scan_status text not null default 'pending'
    check (scan_status in ('pending', 'clean', 'infected', 'skipped'));

alter table public.organizations
  drop constraint if exists organizations_kind_check;
alter table public.organizations
  add constraint organizations_kind_check check (kind in ('admin', 'partner'));

create table if not exists public.data_retention_config (
  id boolean primary key default true,
  audit_email_redaction_days integer not null default 90 check (audit_email_redaction_days between 30 and 3650),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_retention_config_singleton check (id)
);

insert into public.data_retention_config (id)
values (true)
on conflict (id) do nothing;

drop policy if exists "student invites visible by admin" on public.student_invites;
drop policy if exists "student invites visible by creator or admin" on public.student_invites;
create policy "student invites visible by creator or admin" on public.student_invites
for select using (
  public.current_role() = 'admin'
  or created_by = auth.uid()
);

create or replace function public.log_audit_event(
  entity_type text,
  entity_id uuid,
  action text,
  metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_id uuid;
  actor_org_id uuid;
  allowed_entities text[] := array[
    'auth',
    'application',
    'applications',
    'document',
    'documents',
    'commission',
    'commissions',
    'account_request',
    'account_requests',
    'student',
    'students',
    'task',
    'tasks',
    'payment',
    'system'
  ];
begin
  if entity_type is null or not (entity_type = any(allowed_entities)) then
    raise exception 'Unsupported audit entity_type: %', entity_type using errcode = '22023';
  end if;

  if action is null or action !~ '^[a-z][a-z0-9_]{0,63}$' then
    raise exception 'Unsupported audit action: %', action using errcode = '22023';
  end if;

  actor_org_id := public.current_org_id();

  insert into public.audit_events (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    actor_org_id,
    auth.uid(),
    entity_type,
    entity_id,
    action,
    coalesce(metadata, '{}'::jsonb)
  )
  returning id into audit_id;

  return audit_id;
end;
$$;

create or replace function public.redact_old_audit_metadata()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  retention_days integer;
  changed_rows integer;
begin
  select audit_email_redaction_days into retention_days
  from public.data_retention_config
  where id = true;

  update public.audit_events
     set metadata = jsonb_set(
       metadata - 'email',
       '{email_sha256}',
       to_jsonb(encode(digest(metadata->>'email', 'sha256'), 'hex')),
       true
     )
   where metadata ? 'email'
     and created_at < now() - make_interval(days => coalesce(retention_days, 90));

  get diagnostics changed_rows = row_count;
  return changed_rows;
end;
$$;

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

  if exists (
    select 1
    from public.tasks t
    where t.application_id = new.id
      and t.title = task_title
      and t.created_at >= now() - interval '7 days'
  ) then
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
end;
$$;

