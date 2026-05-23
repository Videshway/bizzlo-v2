-- Partner portal login identity shown to Videshway admins.

alter table public.profiles
add column if not exists portal_username text;

alter table public.account_requests
add column if not exists portal_username text;

update public.profiles
set portal_username = lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9._-]+', '-', 'g'))
where portal_username is null
  and email is not null;

update public.account_requests
set portal_username = lower(regexp_replace(coalesce(organization_name, split_part(email, '@', 1)), '[^a-z0-9._-]+', '-', 'g'))
where portal_username is null
  and role = 'manager';

update public.account_requests
set portal_username = lower(regexp_replace(split_part(email, '@', 1), '[^a-z0-9._-]+', '-', 'g'))
where portal_username is null
  and role = 'counselor';

with duplicated_profiles as (
  select id,
         portal_username,
         row_number() over (partition by lower(portal_username) order by created_at, id) as row_number
  from public.profiles
  where portal_username is not null
)
update public.profiles p
set portal_username = left(d.portal_username, 39) || '-' || substr(p.id::text, 1, 8)
from duplicated_profiles d
where p.id = d.id
  and d.row_number > 1;

alter table public.profiles
drop constraint if exists profiles_portal_username_format;

alter table public.profiles
add constraint profiles_portal_username_format
check (
  portal_username is null
  or portal_username ~ '^[a-z0-9._-]{3,48}$'
);

alter table public.account_requests
drop constraint if exists account_requests_portal_username_format;

alter table public.account_requests
add constraint account_requests_portal_username_format
check (
  portal_username is null
  or portal_username ~ '^[a-z0-9._-]{3,48}$'
);

create unique index if not exists idx_profiles_portal_username_unique
on public.profiles (lower(portal_username))
where portal_username is not null;

create index if not exists idx_account_requests_portal_username
on public.account_requests (lower(portal_username), status);
