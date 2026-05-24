-- Super admin owns partner setup and finance; admissions admin owns files only.

create or replace function public.is_admin_role()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.current_role()::text in ('super_admin', 'admin')
$$;

create or replace function public.can_manage_owner_controls()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.current_role() = 'super_admin'
    or (
      public.current_role() = 'admin'
      and not exists (
        select 1
        from public.profiles p
        where p.role = 'super_admin'
          and p.is_active = true
      )
    )
$$;

create or replace function public.can_access_student(student_row public.students)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    public.is_admin_role()
    or (
      public.current_role() = 'manager'
      and student_row.organization_id = public.current_org_id()
    )
    or (
      public.current_role() = 'counselor'
      and student_row.organization_id = public.current_org_id()
      and student_row.counselor_id = auth.uid()
    )
$$;

alter table public.commissions
  add column if not exists invoice_amount numeric(12, 2),
  add column if not exists approved_amount numeric(12, 2),
  add column if not exists invoice_reason text,
  add column if not exists invoice_status text not null default 'not_submitted'
    check (invoice_status in ('not_submitted', 'submitted', 'accepted', 'rejected')),
  add column if not exists invoice_submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists invoice_submitted_at timestamptz,
  add column if not exists invoice_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists invoice_reviewed_at timestamptz,
  add column if not exists payout_status text not null default 'not_due'
    check (payout_status in ('not_due', 'pending', 'approved', 'paid', 'held', 'rejected'));

create index if not exists idx_commissions_invoice_status
  on public.commissions (organization_id, invoice_status, payout_status, updated_at desc);

drop policy if exists "admins read organizations" on public.organizations;
create policy "admins read organizations" on public.organizations
for select using (public.is_admin_role() or id = public.current_org_id());

drop policy if exists "admins manage organizations" on public.organizations;
create policy "super admins manage organizations" on public.organizations
for all using (public.can_manage_owner_controls())
with check (public.can_manage_owner_controls());

drop policy if exists "profiles visible by organization" on public.profiles;
create policy "profiles visible by organization" on public.profiles
for select using (public.is_admin_role() or organization_id = public.current_org_id() or id = auth.uid());

drop policy if exists "admins manage profiles" on public.profiles;
create policy "super admins manage profiles" on public.profiles
for all using (public.can_manage_owner_controls())
with check (public.can_manage_owner_controls());

drop policy if exists "account requests visible by org or admin" on public.account_requests;
create policy "account requests visible by org or admin" on public.account_requests
for select using (
  public.is_admin_role()
  or organization_id = public.current_org_id()
  or requested_by = auth.uid()
);

drop policy if exists "admins create manager requests" on public.account_requests;
create policy "super admins create manager requests" on public.account_requests
for insert with check (
  public.can_manage_owner_controls()
  and role = 'manager'
  and requested_by = auth.uid()
);

drop policy if exists "admins update account requests" on public.account_requests;
create policy "super admins update account requests" on public.account_requests
for update using (public.can_manage_owner_controls())
with check (public.can_manage_owner_controls());

drop policy if exists "managers and counselors create students" on public.students;
create policy "managers and counselors create students" on public.students
for insert with check (
  public.is_admin_role()
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

drop policy if exists "admins manage courses" on public.courses;
create policy "admins manage courses" on public.courses
for all using (public.is_admin_role()) with check (public.is_admin_role());

drop policy if exists "applications update through student" on public.applications;
create policy "applications update through student" on public.applications
for update using (
  exists (
    select 1 from public.students s
    where s.id = applications.student_id
      and public.can_access_student(s)
  )
  and (
    public.is_admin_role()
    or applications.status in (
      'profile_incomplete',
      'documents_pending',
      'admin_changes_requested'
    )
  )
) with check (
  exists (
    select 1 from public.students s
    where s.id = applications.student_id
      and public.can_access_student(s)
  )
  and (
    public.is_admin_role()
    or status in (
      'profile_incomplete',
      'documents_pending',
      'ready_for_admin_review',
      'admin_changes_requested'
    )
  )
);

drop policy if exists "documents reviewed by admins" on public.documents;
create policy "documents reviewed by admins" on public.documents
for update using (public.is_admin_role()) with check (public.is_admin_role());

drop policy if exists "tasks visible by assignment or student" on public.tasks;
create policy "tasks visible by assignment or student" on public.tasks
for select using (
  public.is_admin_role()
  or assigned_to = auth.uid()
  or exists (select 1 from public.students s where s.id = tasks.student_id and public.can_access_student(s))
);

drop policy if exists "tasks update by assignment or admin" on public.tasks;
create policy "tasks update by assignment or admin" on public.tasks
for update using (
  public.is_admin_role()
  or assigned_to = auth.uid()
  or exists (select 1 from public.students s where s.id = tasks.student_id and public.can_access_student(s))
) with check (
  public.is_admin_role()
  or assigned_to = auth.uid()
  or exists (select 1 from public.students s where s.id = tasks.student_id and public.can_access_student(s))
);

drop policy if exists "commissions admin and manager visible" on public.commissions;
create policy "commissions visible to super admin and manager" on public.commissions
for select using (
  public.can_manage_owner_controls()
  or (public.current_role() = 'manager' and organization_id = public.current_org_id())
);

drop policy if exists "admins manage commissions" on public.commissions;
create policy "super admins manage commissions" on public.commissions
for all using (public.can_manage_owner_controls())
with check (public.can_manage_owner_controls());

drop policy if exists "managers submit commission invoices" on public.commissions;
create policy "managers submit commission invoices" on public.commissions
for update using (
  public.current_role() = 'manager'
  and organization_id = public.current_org_id()
)
with check (
  public.current_role() = 'manager'
  and organization_id = public.current_org_id()
  and invoice_status in ('not_submitted', 'submitted')
);

drop policy if exists "audit visible to admins" on public.audit_events;
create policy "audit visible to admins" on public.audit_events
for select using (public.is_admin_role());

drop policy if exists "student portal sessions admin only" on public.student_portal_sessions;
create policy "student portal sessions admin only" on public.student_portal_sessions
for select using (public.is_admin_role());

drop policy if exists "student invites visible by creator or admin" on public.student_invites;
create policy "student invites visible by creator or admin" on public.student_invites
for select using (
  public.is_admin_role()
  or created_by = auth.uid()
);

drop policy if exists "finance profiles visible by partner or admin" on public.partner_finance_profiles;
create policy "finance profiles visible by partner or super admin" on public.partner_finance_profiles
for select using (
  public.can_manage_owner_controls()
  or (
    public.current_role() = 'manager'
    and organization_id = public.current_org_id()
    and manager_id = auth.uid()
  )
);

drop policy if exists "finance profiles created by partner or admin" on public.partner_finance_profiles;
create policy "finance profiles created by partner or super admin" on public.partner_finance_profiles
for insert with check (
  public.can_manage_owner_controls()
  or (
    public.current_role() = 'manager'
    and organization_id = public.current_org_id()
    and manager_id = auth.uid()
    and status = 'pending_admin_review'
  )
);

drop policy if exists "finance profiles updated by partner or admin" on public.partner_finance_profiles;
create policy "finance profiles updated by partner or super admin" on public.partner_finance_profiles
for update using (
  public.can_manage_owner_controls()
  or (
    public.current_role() = 'manager'
    and organization_id = public.current_org_id()
    and manager_id = auth.uid()
  )
) with check (
  public.can_manage_owner_controls()
  or (
    public.current_role() = 'manager'
    and organization_id = public.current_org_id()
    and manager_id = auth.uid()
    and status = 'pending_admin_review'
  )
);

create or replace function public.guard_commission_finance_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() = 'manager' then
    if new.organization_id is distinct from old.organization_id
      or new.application_id is distinct from old.application_id
      or new.manager_id is distinct from old.manager_id
      or new.expected_amount is distinct from old.expected_amount
      or new.currency is distinct from old.currency
      or new.approved_amount is distinct from old.approved_amount
      or new.invoice_reviewed_by is distinct from old.invoice_reviewed_by
      or new.invoice_reviewed_at is distinct from old.invoice_reviewed_at
      or new.invoice_status not in ('not_submitted', 'submitted')
      or new.payout_status not in ('not_due', 'pending')
      or new.status not in ('projected', 'ready_to_invoice', 'invoiced') then
      raise exception 'Partner managers can only submit invoice details. Super admin controls approval and payout.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_commission_finance_update on public.commissions;
create trigger trg_guard_commission_finance_update
before update on public.commissions
for each row execute function public.guard_commission_finance_update();
