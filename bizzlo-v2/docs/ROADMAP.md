# Bizzlo Build Roadmap

## Phase 1: Partner Admissions Base

Status: complete.

- Admin, manager, and counselor workspaces.
- Partner manager invites and counselor seat requests.
- Student intake, applications, documents, tasks, finance profile, and support.
- Partner-PDF Program Search using only commissionable universities and private seed data.
- Supabase schema, RLS, private storage, and production safety gate.

## Phase 2: Launch Hardening

Status: complete in code, ready for Supabase application and external service setup.

- Migrations 003-006 split workflow enums, finance profiles, persisted operational surfaces, public student portal sessions, and audit logging.
- Migrations 007-010 add OTP, rate limiting, upload caps, document scan status, audit validation, indexes, cleanup jobs, and data-rights tracking.
- Student-scoped storage checks.
- Auto-tasks and auto-commissions on application stage movement.
- Real account invite Edge Function.
- Public `/portal/:student_code` document uploader with OTP, Turnstile, file validation, and HttpOnly upload cookie support.
- Admin audit page.
- Local admin bootstrap script with public sign-ups disabled.
- Legal pages, cookie consent, security/performance/incident/data-export/data-deletion runbooks.

## Phase 3: Launch Operations

Status: code hooks complete; dashboard/account configuration required before production.

- Completed: finance profile, partner tracker, account invite flow, document approval/download, audit trail, student upload links.
- Complete outside the repo: Resend SMTP, Turnstile secret, Sentry project, PostHog project, Statuspage, Cloudflare WAF, branch protection, backup restore drill.
- Keep the present product surface frozen until real partners have used the system.

## Phase 4: Customer-Led Expansion

Status: planned.

- Payments via Razorpay or Stripe.
- Real virus scanning and upload quarantine.
- Status-change notifications by email/WhatsApp if support volume proves it is needed.
- Mobile app for partners/counselors.
- Larger verified catalogue ingestion and eligibility filtering.
- SSO/SAML for large partners.
- Multi-tier sub-agent network and white-label branding.
