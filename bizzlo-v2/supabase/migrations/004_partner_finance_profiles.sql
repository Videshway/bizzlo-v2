-- Partner finance profile table and policies.

create table if not exists public.partner_finance_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  manager_id uuid references public.profiles(id) on delete set null,
  legal_name text not null,
  account_holder text not null,
  bank_name text not null,
  account_number text not null,
  ifsc text,
  swift_code text,
  payout_currency text not null default 'INR',
  gst_registered boolean not null default true,
  gstin text,
  pan text,
  billing_address text,
  status text not null default 'pending_admin_review',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_finance_profiles_manager on public.partner_finance_profiles (manager_id, status);
create index if not exists idx_partner_finance_profiles_org on public.partner_finance_profiles (organization_id, status);

alter table public.partner_finance_profiles enable row level security;

drop policy if exists "finance profiles visible by partner or admin" on public.partner_finance_profiles;
create policy "finance profiles visible by partner or admin" on public.partner_finance_profiles
for select using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'manager'
    and organization_id = public.current_org_id()
    and manager_id = auth.uid()
  )
);

drop policy if exists "finance profiles created by partner or admin" on public.partner_finance_profiles;
create policy "finance profiles created by partner or admin" on public.partner_finance_profiles
for insert with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'manager'
    and organization_id = public.current_org_id()
    and manager_id = auth.uid()
    and status = 'pending_admin_review'
  )
);

drop policy if exists "finance profiles updated by partner or admin" on public.partner_finance_profiles;
create policy "finance profiles updated by partner or admin" on public.partner_finance_profiles
for update using (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'manager'
    and organization_id = public.current_org_id()
    and manager_id = auth.uid()
  )
) with check (
  public.current_role() = 'admin'
  or (
    public.current_role() = 'manager'
    and organization_id = public.current_org_id()
    and manager_id = auth.uid()
    and status = 'pending_admin_review'
  )
);
