# Bizzlo v2 Deployment

## Stack

- Frontend: Vite React SPA on Vercel.
- Database/Auth/Storage: Supabase Postgres, Auth, Edge Functions, and private Storage.
- Document bucket: `student-documents`.
- Production domain: `https://bizzlo.co`.

## Supabase Setup

1. Create a fresh Supabase project.
2. In Auth settings, keep public sign-ups permanently disabled.
3. Configure Auth SMTP with Supabase SMTP, Resend, Postmark, or SES before inviting partners.
4. Set Auth Site URL to `https://bizzlo.co` and add Vercel preview URLs to redirect allow-list.
5. Run migrations in order:
   - `001_initial_schema.sql`
   - `002_course_catalog_import_readiness.sql`
   - `003_application_status_values.sql`
   - `004_partner_finance_profiles.sql`
   - `005_launch_hardening.sql`
   - `006_student_portal_and_audit.sql`
   - `007_portal_otp.sql`
   - `008_security_plumbing.sql`
   - `009_indexes_and_cron.sql`
   - `010_data_rights.sql`
6. Deploy Edge Functions:
   - `invite-user`
   - `redeem-student-invite`
   - `student-upload-document`
   - `scan-document-stub`
   - `export-organization-data`
   - `purge-student`
   - `purge-organization`
7. Add Edge Function env vars:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SITE_URL=https://bizzlo.co`
   - `TURNSTILE_SECRET_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `SCAN_STUB_SECRET`
8. Run `npm run bootstrap:admin` locally with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `BIZZLO_ADMIN_EMAIL`.
9. Seed partner-PDF courses locally with `npm run seed:supabase-courses`.
10. Confirm bucket `student-documents` is private and RLS is enabled on all public tables.

## Account Invites

Videshway admin creates partner manager requests from Team & Partners. The `invite-user` Edge Function sends the actual Supabase Auth invite email and idempotently creates the matching `public.profiles` row. Partner managers can request counselor accounts; admin sends those invites the same way.

Supabase Auth email templates should be branded for Bizzlo and point users back to `https://bizzlo.co/`.

## Public Student Portal

Counselors generate a signed `/portal/:student_code?token=...` link from a student row. The public portal:

- verifies Cloudflare Turnstile,
- sends a six-digit OTP to the student email,
- verifies the OTP through `redeem-student-invite`,
- marks the invite as used,
- receives a short-lived upload session cookie,
- uploads documents through `student-upload-document`,
- never mounts the internal dashboard shell.

If a student opens the same link twice, the portal shows the expired/used state and asks them to request a new link.

## Vercel Setup

Use the repository root as the Vercel project root so the outer `vercel.json` is used.

Set environment variables for Production and Preview:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_SENTRY_DSN`
- `VITE_POSTHOG_KEY`

Do not set `VITE_ENABLE_DEMO=true` in Vercel.

## Local Development

```bash
npm install
npm run dev
```

Without Supabase env vars, the app runs in demo mode with seed data. With Supabase env vars, the app uses real login, RLS-scoped reads, private uploads, and Edge Functions.

## Security Checklist Before Launch

- Public sign-ups disabled.
- SMTP/Auth templates configured.
- Migrations 001-010 applied.
- Edge Functions deployed with `SITE_URL`.
- Branch protection enabled on `main`, requiring the `Bizzlo Tests` workflow.
- Cloudflare Turnstile, Resend SMTP/API, Sentry, and PostHog configured where env-gated.
- Admin bootstrapped via local script, not browser HTML.
- Service-role key never added to Vercel frontend env.
- Private storage bucket only.
- Course seed data kept in `private-data/`, not public CDN assets.
- Cloudflare WAF and rate limits enabled.
- Supabase backups enabled and restore tested.
