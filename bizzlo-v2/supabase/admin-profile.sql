-- Run after the first Bizzlo Supabase Auth user exists.
-- This links info@videshway.com to the master Videshway admin profile.

with org as (
  insert into public.organizations (name, kind, counselor_limit, status)
  values ('Videshway', 'admin', 100, 'active')
  on conflict do nothing
  returning id
),
picked_org as (
  select id from org
  union all
  select id from public.organizations
  where name = 'Videshway' and kind = 'admin'
  limit 1
)
insert into public.profiles (id, organization_id, full_name, email, role, is_active)
select u.id, picked_org.id, 'Videshway Admin', u.email, 'admin'::public.user_role, true
from auth.users u
cross join picked_org
where lower(u.email) = lower('info@videshway.com')
on conflict (id) do update set
  organization_id = excluded.organization_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = true;
