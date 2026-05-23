-- Public student portal sessions and real audit logging.

create table if not exists public.student_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.student_invites(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  session_hash text not null unique,
  status text not null default 'active',
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now()
);

create index if not exists idx_student_invites_token_lookup on public.student_invites (token_hash, status, expires_at);
create index if not exists idx_student_portal_sessions_lookup on public.student_portal_sessions (session_hash, status, expires_at);
create index if not exists idx_audit_events_entity_created on public.audit_events (entity_type, action, created_at desc);

alter table public.student_portal_sessions enable row level security;

create or replace function public.check_public_rls()
returns table(table_name text, rls_enabled boolean)
language sql
security definer
set search_path = public
as $$
  select c.relname::text as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname not like 'pg_%'
  order by c.relname;
$$;

drop policy if exists "student portal sessions admin only" on public.student_portal_sessions;
create policy "student portal sessions admin only" on public.student_portal_sessions
for select using (public.current_role() = 'admin');

drop policy if exists "student invites visible through student" on public.student_invites;
drop policy if exists "student invites visible by admin" on public.student_invites;
create policy "student invites visible by admin" on public.student_invites
for select using (public.current_role() = 'admin');

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
begin
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

create or replace function public.audit_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  actor uuid;
  entity uuid;
  event_action text;
  event_metadata jsonb;
begin
  actor := auth.uid();
  entity := new.id;

  if tg_table_name = 'applications' then
    org_id := new.organization_id;
    if tg_op = 'INSERT' then
      event_action := 'application_created';
      event_metadata := jsonb_build_object('status', new.status, 'student_id', new.student_id);
    elsif old.status is distinct from new.status then
      event_action := 'application_status_changed';
      event_metadata := jsonb_build_object('old_status', old.status, 'new_status', new.status, 'student_id', new.student_id);
    else
      return new;
    end if;
  elsif tg_table_name = 'documents' then
    org_id := new.organization_id;
    if tg_op = 'INSERT' then
      event_action := 'document_uploaded';
      event_metadata := jsonb_build_object('status', new.status, 'student_id', new.student_id, 'document_type', new.document_type);
    elsif old.status is distinct from new.status then
      event_action := 'document_status_changed';
      event_metadata := jsonb_build_object('old_status', old.status, 'new_status', new.status, 'student_id', new.student_id, 'document_type', new.document_type);
    else
      return new;
    end if;
  elsif tg_table_name = 'commissions' then
    org_id := new.organization_id;
    if tg_op = 'INSERT' then
      event_action := 'commission_created';
      event_metadata := jsonb_build_object('status', new.status, 'application_id', new.application_id, 'amount', new.expected_amount, 'currency', new.currency);
    elsif old.status is distinct from new.status then
      event_action := 'commission_status_changed';
      event_metadata := jsonb_build_object('old_status', old.status, 'new_status', new.status, 'application_id', new.application_id);
    else
      return new;
    end if;
  elsif tg_table_name = 'account_requests' then
    org_id := new.organization_id;
    if tg_op = 'INSERT' then
      event_action := 'account_request_created';
      event_metadata := jsonb_build_object('status', new.status, 'role', new.role, 'email', new.email);
    elsif old.status is distinct from new.status then
      event_action := 'account_request_status_changed';
      event_metadata := jsonb_build_object('old_status', old.status, 'new_status', new.status, 'role', new.role, 'email', new.email);
    else
      return new;
    end if;
  else
    return new;
  end if;

  insert into public.audit_events (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    org_id,
    actor,
    tg_table_name,
    entity,
    event_action,
    event_metadata
  );

  return new;
end;
$$;

drop trigger if exists trg_audit_applications on public.applications;
create trigger trg_audit_applications
after insert or update on public.applications
for each row execute function public.audit_table_change();

drop trigger if exists trg_audit_documents on public.documents;
create trigger trg_audit_documents
after insert or update on public.documents
for each row execute function public.audit_table_change();

drop trigger if exists trg_audit_commissions on public.commissions;
create trigger trg_audit_commissions
after insert or update on public.commissions
for each row execute function public.audit_table_change();

drop trigger if exists trg_audit_account_requests on public.account_requests;
create trigger trg_audit_account_requests
after insert or update on public.account_requests
for each row execute function public.audit_table_change();

do $$
begin
  alter publication supabase_realtime add table public.audit_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
