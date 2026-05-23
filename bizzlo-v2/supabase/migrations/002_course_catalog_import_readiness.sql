alter table public.courses
  add column if not exists catalog_key text,
  add column if not exists external_course_id text,
  add column if not exists source_name text,
  add column if not exists application_fee text,
  add column if not exists updated_at timestamptz not null default now();

update public.courses
set catalog_key = concat_ws(
  '|',
  lower(trim(coalesce(country, ''))),
  lower(trim(coalesce(university, ''))),
  lower(trim(coalesce(course, ''))),
  lower(trim(coalesce(level, ''))),
  lower(trim(coalesce(intake, ''))),
  lower(trim(coalesce(campus, ''))),
  lower(trim(coalesce(credential, ''))),
  lower(trim(coalesce(mode, '')))
)
where catalog_key is null;

create unique index if not exists idx_courses_catalog_key on public.courses (catalog_key);
create index if not exists idx_courses_source on public.courses (source_name, source_updated_at);
