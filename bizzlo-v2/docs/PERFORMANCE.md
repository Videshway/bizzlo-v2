# Bizzlo Performance

## Launch Target

The launch target is 50 partners, about 2,500 students, 7,500 applications, and 25,000 documents.

## Database Indexes

Migration `009_indexes_and_cron.sql` adds launch indexes for:

- `documents(student_id, status, created_at desc)`
- `applications(organization_id, status, updated_at desc)`
- `tasks(organization_id, status, due_date asc)`
- `audit_events(organization_id, created_at desc)`
- `commissions(organization_id, status, updated_at desc)`

## Course Search

Use `public.search_courses(...)` for server-side filtering once Supabase is seeded. The local demo still uses seed rows. The private seed file remains `private-data/partner-course-templates.json`.

## Verification

Run representative `EXPLAIN ANALYZE` queries in Supabase SQL Editor before launch and confirm the indexes above are used for dashboard and list queries.

