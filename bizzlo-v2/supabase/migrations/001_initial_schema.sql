-- Bizzlo v2 production schema
-- Apply in Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('admin', 'manager', 'counselor');
create type public.application_status as enum (
  'profile_incomplete',
  'documents_pending',
  'ready_for_admin_review',
  'pending_admin_review',
  'admin_changes_requested',
  'submitted_to_university',
  'awaiting_decision',
  'conditional_offer',
  'unconditional_offer',
  'deposit_paid',
  'visa_filed',
  'enrolled',
  'rejected'
);
create type public.document_status as enum ('uploaded', 'scanning', 'approved', 'rejected', 'replaced');
create type public.commission_status as enum ('projected', 'ready_to_invoice', 'invoiced', 'paid', 'disputed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'partner',
  counselor_limit integer not null default 1 check (counselor_limit >= 1),
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  manager_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null unique,
  role public.user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.organizations
add column primary_manager_id uuid references public.profiles(id) on delete set null;

create table public.account_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  organization_name text,
  role public.user_role not null,
  manager_id uuid references public.profiles(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null,
  status text not null default 'needs_auth_user',
  note text,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  manager_id uuid references public.profiles(id) on delete set null,
  counselor_id uuid references public.profiles(id) on delete set null,
  student_code text not null unique,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  nationality text,
  desired_countries text[] not null default '{}',
  study_level text,
  discipline text,
  intake text,
  profile_score integer not null default 0 check (profile_score >= 0 and profile_score <= 100),
  status public.application_status not null default 'profile_incomplete',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  catalog_key text,
  external_course_id text,
  source_name text,
  university text not null,
  country text not null,
  city text,
  campus text,
  level text,
  subject text,
  course text not null,
  credential text,
  duration text,
  mode text,
  intake text,
  tuition text,
  application_fee text,
  deadline text,
  commission_hint text,
  eligibility_notes text,
  english_requirement text,
  academic_requirement text,
  scholarship text,
  source_url text,
  source_updated_at date,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  manager_id uuid references public.profiles(id) on delete set null,
  counselor_id uuid references public.profiles(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  university text not null,
  country text,
  course text not null,
  intake text,
  status public.application_status not null default 'documents_pending',
  fee_status text not null default 'not_paid',
  deposit_status text not null default 'not_due',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  status public.application_status,
  note text,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  document_type text not null,
  original_filename text not null,
  storage_bucket text not null default 'student-documents',
  storage_path text not null unique,
  content_type text,
  file_size bigint,
  checksum text,
  status public.document_status not null default 'uploaded',
  rejection_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  priority text not null default 'Medium',
  due_date date,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  application_id uuid not null unique references public.applications(id) on delete cascade,
  manager_id uuid references public.profiles(id) on delete set null,
  expected_amount numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  commission_rate numeric(6, 2),
  status public.commission_status not null default 'projected',
  invoice_number text,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_profiles_org_role on public.profiles (organization_id, role);
create index idx_account_requests_org_role on public.account_requests (organization_id, role, status);
create index idx_courses_country_level on public.courses (country, level);
create index idx_courses_university on public.courses (university);
create unique index idx_courses_catalog_key on public.courses (catalog_key);
create index idx_courses_source on public.courses (source_name, source_updated_at);
create index idx_students_org_manager on public.students (organization_id, manager_id);
create index idx_students_counselor on public.students (counselor_id);
create index idx_applications_student_status on public.applications (student_id, status);
create index idx_applications_manager_status on public.applications (manager_id, status);
create index idx_documents_student_status on public.documents (student_id, status);
create index idx_tasks_assigned_status on public.tasks (assigned_to, status);
create index idx_commissions_manager_status on public.commissions (manager_id, status);
create index idx_audit_actor_created on public.audit_events (actor_id, created_at desc);

create or replace function public.current_profile()
returns public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select * from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.current_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.current_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id from public.profiles where id = auth.uid() and is_active = true
$$;

create or replace function public.can_access_student(student_row public.students)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.current_role() = 'admin'
    or (
      public.current_role() = 'manager'
      and student_row.organization_id = public.current_org_id()
      and student_row.manager_id = auth.uid()
    )
    or (
      public.current_role() = 'counselor'
      and student_row.organization_id = public.current_org_id()
      and student_row.counselor_id = auth.uid()
    )
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.account_requests enable row level security;
alter table public.students enable row level security;
alter table public.courses enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.documents enable row level security;
alter table public.tasks enable row level security;
alter table public.commissions enable row level security;
alter table public.audit_events enable row level security;

create policy "admins read organizations" on public.organizations for select using (public.current_role() = 'admin' or id = public.current_org_id());

create policy "admins manage organizations" on public.organizations
for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "profiles visible by organization" on public.profiles
for select using (public.current_role() = 'admin' or organization_id = public.current_org_id() or id = auth.uid());

create policy "admins manage profiles" on public.profiles
for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "account requests visible by org or admin" on public.account_requests
for select using (
  public.current_role() = 'admin'
  or organization_id = public.current_org_id()
  or requested_by = auth.uid()
);

create policy "admins create manager requests" on public.account_requests
for insert with check (
  public.current_role() = 'admin'
  and role = 'manager'
  and requested_by = auth.uid()
);

create policy "managers create counselor requests" on public.account_requests
for insert with check (
  public.current_role() = 'manager'
  and role = 'counselor'
  and organization_id = public.current_org_id()
  and manager_id = auth.uid()
  and requested_by = auth.uid()
  and (
    select count(*)
    from public.profiles p
    where p.organization_id = public.current_org_id()
      and p.role = 'counselor'
      and p.is_active = true
  ) < (
    select counselor_limit
    from public.organizations o
    where o.id = public.current_org_id()
  )
);

create policy "admins update account requests" on public.account_requests
for update using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "students visible by ownership" on public.students
for select using (public.can_access_student(students));

create policy "managers and counselors create students" on public.students
for insert with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'manager'
    and organization_id = public.current_org_id()
    and manager_id = auth.uid()
  )
  or (
    public.current_role() = 'counselor'
    and organization_id = public.current_org_id()
    and counselor_id = auth.uid()
  )
);

create policy "students update by ownership" on public.students
for update using (public.can_access_student(students)) with check (public.can_access_student(students));

create policy "courses readable to active users" on public.courses
for select using (public.current_role() is not null and is_active = true);

create policy "admins manage courses" on public.courses
for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "applications visible through student" on public.applications
for select using (exists (
  select 1 from public.students s where s.id = applications.student_id and public.can_access_student(s)
));

create policy "applications create through student" on public.applications
for insert with check (exists (
  select 1 from public.students s where s.id = applications.student_id and public.can_access_student(s)
));

create policy "applications update through student" on public.applications
for update using (exists (
  select 1 from public.students s where s.id = applications.student_id and public.can_access_student(s)
)) with check (exists (
  select 1 from public.students s where s.id = applications.student_id and public.can_access_student(s)
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
));

create policy "events visible through application" on public.application_events
for select using (exists (
  select 1
  from public.applications a
  join public.students s on s.id = a.student_id
  where a.id = application_events.application_id and public.can_access_student(s)
));

create policy "documents visible through student" on public.documents
for select using (exists (
  select 1 from public.students s where s.id = documents.student_id and public.can_access_student(s)
));

create policy "documents create through student" on public.documents
for insert with check (exists (
  select 1 from public.students s where s.id = documents.student_id and public.can_access_student(s)
));

create policy "documents reviewed by admins" on public.documents
for update using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "tasks visible by assignment or student" on public.tasks
for select using (
  public.current_role() = 'admin'
  or assigned_to = auth.uid()
  or exists (select 1 from public.students s where s.id = tasks.student_id and public.can_access_student(s))
);

create policy "tasks update by assignment or admin" on public.tasks
for update using (
  public.current_role() = 'admin'
  or assigned_to = auth.uid()
  or exists (select 1 from public.students s where s.id = tasks.student_id and public.can_access_student(s))
) with check (
  public.current_role() = 'admin'
  or assigned_to = auth.uid()
  or exists (select 1 from public.students s where s.id = tasks.student_id and public.can_access_student(s))
);

create policy "commissions admin and manager visible" on public.commissions
for select using (
  public.current_role() = 'admin'
  or (public.current_role() = 'manager' and manager_id = auth.uid() and organization_id = public.current_org_id())
);

create policy "admins manage commissions" on public.commissions
for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

create policy "audit visible to admins" on public.audit_events
for select using (public.current_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('student-documents', 'student-documents', false)
on conflict (id) do nothing;

create policy "authenticated document object uploads" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'student-documents'
  and public.current_role() is not null
  and (
    public.current_role() = 'admin'
    or (storage.foldername(name))[1] = public.current_org_id()::text
  )
);

create policy "authenticated document object reads" on storage.objects
for select to authenticated
using (
  bucket_id = 'student-documents'
  and exists (
    select 1
    from public.documents d
    where d.storage_bucket = storage.objects.bucket_id
      and d.storage_path = storage.objects.name
      and exists (
        select 1 from public.students s where s.id = d.student_id and public.can_access_student(s)
      )
  )
);
