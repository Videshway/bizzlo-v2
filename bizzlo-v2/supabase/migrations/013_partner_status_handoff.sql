-- Partners can prepare a file and hand it to Videshway admin, but admin owns
-- review, university submission, offer, visa, and enrollment movement.

drop policy if exists "applications update through student" on public.applications;
create policy "applications update through student" on public.applications
for update using (
  exists (
    select 1 from public.students s
    where s.id = applications.student_id
      and public.can_access_student(s)
  )
  and (
    public.current_role() = 'admin'
    or applications.status in (
      'profile_incomplete',
      'documents_pending',
      'ready_for_admin_review',
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
    public.current_role() = 'admin'
    or status in (
      'profile_incomplete',
      'documents_pending',
      'ready_for_admin_review',
      'admin_changes_requested'
    )
  )
);
