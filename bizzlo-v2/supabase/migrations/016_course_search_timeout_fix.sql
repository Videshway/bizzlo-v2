-- Keep Program Search under Supabase statement limits.
-- The previous RPC ranked every matching course before applying the limit, which
-- could time out on the 64k-row partner catalogue. This version returns a simple
-- indexed page and lets the UI request more rows when needed.

create index if not exists idx_courses_active_catalog
  on public.courses (is_active, catalog_key);

create index if not exists idx_courses_active_country_level_intake
  on public.courses (is_active, country, level, intake, university, course);

create or replace function public.search_courses(
  filter_country text default null,
  filter_level text default null,
  filter_intake text default null,
  filter_query text default null,
  page_limit integer default 60,
  page_offset integer default 0
)
returns setof public.courses
language sql
stable
security invoker
set search_path = public
as $$
  select c.*
  from public.courses c
  where c.is_active = true
    and (filter_country is null or filter_country = '' or filter_country = 'All' or c.country = filter_country)
    and (filter_level is null or filter_level = '' or filter_level = 'All' or c.level = filter_level)
    and (filter_intake is null or filter_intake = '' or filter_intake = 'All' or c.intake ilike '%' || filter_intake || '%')
    and (
      filter_query is null
      or filter_query = ''
      or lower(
        coalesce(c.university, '') || ' ' ||
        coalesce(c.course, '') || ' ' ||
        coalesce(c.subject, '') || ' ' ||
        coalesce(c.city, '') || ' ' ||
        coalesce(c.country, '')
      ) like '%' || lower(filter_query) || '%'
    )
  order by c.country asc, c.university asc, c.course asc
  limit least(greatest(coalesce(page_limit, 60), 1), 500)
  offset greatest(coalesce(page_offset, 0), 0);
$$;
