-- Launch-scale indexes, course search RPC, and scheduled cleanup hooks.

do $$
begin
  create extension if not exists pg_trgm;
exception
  when insufficient_privilege then null;
  when undefined_file then null;
end;
$$;

create index if not exists idx_documents_student_status_created
  on public.documents (student_id, status, created_at desc);
create index if not exists idx_applications_org_status_updated
  on public.applications (organization_id, status, updated_at desc);
create index if not exists idx_tasks_org_status_due
  on public.tasks (organization_id, status, due_date asc);
create index if not exists idx_audit_events_org_created
  on public.audit_events (organization_id, created_at desc);
create index if not exists idx_commissions_org_status_updated
  on public.commissions (organization_id, status, updated_at desc);

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'create index if not exists idx_courses_search_trgm on public.courses using gin ((lower(coalesce(university, '''') || '' '' || coalesce(course, '''') || '' '' || coalesce(subject, '''') || '' '' || coalesce(city, '''') || '' '' || coalesce(country, ''''))) gin_trgm_ops)';
  end if;
end;
$$;

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
      or lower(coalesce(c.university, '') || ' ' || coalesce(c.course, '') || ' ' || coalesce(c.subject, '') || ' ' || coalesce(c.city, '') || ' ' || coalesce(c.country, ''))
        like '%' || lower(filter_query) || '%'
    )
  order by c.university asc, c.course asc
  limit least(greatest(coalesce(page_limit, 60), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

do $$
begin
  create extension if not exists pg_cron with schema extensions;
exception
  when insufficient_privilege then null;
  when undefined_file then null;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cron$
      select cron.schedule(
        'bizzlo-nightly-portal-cleanup',
        '17 2 * * *',
        $job$
          delete from public.student_portal_sessions where expires_at < now() - interval '7 days';
          delete from public.student_portal_otps where created_at < now() - interval '1 day';
          delete from public.request_throttle where window_start < now() - interval '1 day';
          select public.redact_old_audit_metadata();
        $job$
      )
    $cron$;
  end if;
exception
  when duplicate_object then null;
  when unique_violation then null;
  when undefined_function then null;
end;
$$;

