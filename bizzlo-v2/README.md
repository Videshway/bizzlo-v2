# Bizzlo v2

Fresh Bizzlo partner admissions portal for Videshway, built as the new product base.

## What Is Built

- Manager accounts for partner owners.
- Partner manager creation by Videshway admin.
- One-seat counselor creation/request flow for partner managers.
- Counselor student intake flow: student info, university/course selection, application creation.
- Admin visibility across all partners.
- Student file dashboard.
- Application board.
- Document vault flow.
- Public student upload portal with one-time document links.
- OTP-protected student portal with Turnstile verification, upload caps, and file validation.
- Partner-PDF Program Search with only commissionable partner universities and UG/PG programme templates.
- Task center.
- Commission ledger for managers/admins.
- Admin audit trail for applications, documents, commissions, and account requests.
- Supabase schema and private storage policy.
- Supabase Edge Functions for user invites, student uploads, scan stubs, export, and purge workflows.
- Supabase login mode with protected uploads when env vars are set.
- Sentry/PostHog-ready telemetry hooks, legal routes, DNS/security runbooks, and RLS check tooling.
- Production safety gate that blocks live demo mode unless Supabase is configured.
- Vercel deployment configuration.

## Run

```bash
npm install
npm run dev
```

## Deploy

Follow `docs/DEPLOYMENT.md`.

## Roadmap

Follow `docs/ROADMAP.md`.

## Full Course Catalog

Use `docs/COURSE_CATALOG_IMPORT.md` for the partner-PDF catalogue workflow.

```bash
npm run test:catalog-integrations
npm run seed:supabase-courses
```

## Admin Bootstrap

Public sign-ups stay disabled. Create the first admin locally after migrations:

```bash
SUPABASE_URL="https://your-project.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
BIZZLO_ADMIN_EMAIL="admin@example.com" \
npm run bootstrap:admin
```
