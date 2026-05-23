-- Fix ambiguous parameter/column references in the Edge Function rate limiter.

drop function if exists public.edge_check_rate_limit(text, integer);

create function public.edge_check_rate_limit(bucket text, max_count integer)
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
  values ($1, current_window, 1)
  on conflict on constraint request_throttle_pkey do update
    set count = public.request_throttle.count + 1
  returning public.request_throttle.count into current_count;

  return current_count <= $2;
end;
$$;

revoke all on function public.edge_check_rate_limit(text, integer) from public;
revoke all on function public.edge_check_rate_limit(text, integer) from authenticated;
grant execute on function public.edge_check_rate_limit(text, integer) to service_role;
