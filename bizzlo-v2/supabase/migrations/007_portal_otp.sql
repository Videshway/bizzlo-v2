-- Student portal OTP, throttling, and upload-session limits.

create table if not exists public.student_portal_otps (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.student_invites(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.request_throttle (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  primary key (bucket, window_start)
);

alter table public.student_portal_sessions
  add column if not exists upload_count integer not null default 0 check (upload_count >= 0),
  add column if not exists max_uploads integer not null default 12 check (max_uploads between 1 and 100);

alter table public.student_portal_otps enable row level security;
alter table public.request_throttle enable row level security;

create index if not exists idx_student_portal_otps_invite_created
  on public.student_portal_otps (invite_id, created_at desc);
create index if not exists idx_student_portal_otps_lookup
  on public.student_portal_otps (invite_id, used_at, expires_at);
create index if not exists idx_request_throttle_cleanup
  on public.request_throttle (window_start);

create or replace function public.edge_check_rate_limit(bucket text, max_count integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz := date_trunc('minute', now());
  current_count integer;
begin
  insert into public.request_throttle (bucket, window_start, count)
  values (bucket, current_window, 1)
  on conflict (bucket, window_start) do update
    set count = public.request_throttle.count + 1
  returning count into current_count;

  return current_count <= max_count;
end;
$$;

create or replace function public.claim_student_portal_upload(upload_session_hash text)
returns table (
  session_id uuid,
  invite_id uuid,
  organization_id uuid,
  student_id uuid,
  upload_count integer,
  max_uploads integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.student_portal_sessions s
     set upload_count = s.upload_count + 1
   where s.session_hash = upload_session_hash
     and s.status = 'active'
     and s.expires_at > now()
     and s.upload_count < s.max_uploads
  returning s.id, s.invite_id, s.organization_id, s.student_id, s.upload_count, s.max_uploads;
end;
$$;

revoke all on function public.edge_check_rate_limit(text, integer) from public;
revoke all on function public.claim_student_portal_upload(text) from public;
grant execute on function public.edge_check_rate_limit(text, integer) to service_role;
grant execute on function public.claim_student_portal_upload(text) to service_role;
