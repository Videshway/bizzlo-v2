# Bizzlo Security

## Threat Model

- Student invite links can be forwarded or screenshotted.
- Public upload endpoints can be abused by bots.
- Large or invalid files can exhaust storage or processing.
- Partner users must never access another organization's students or documents.
- Counselors inside the same organization should only see data allowed by role.
- Audit logs can accidentally store personal data forever.
- Bootstrap/admin setup must not rely on public sign-up windows.
- Edge Functions must avoid leaking service-role powers to browsers.

## Defenses

- Student portal requires Cloudflare Turnstile plus a six-digit email OTP before an upload session is issued.
- Three wrong OTP attempts block the invite.
- Edge Functions rate-limit by hashed IP, endpoint, and minute through `request_throttle`.
- Student upload sessions cap uploads at 12 files and expire after two hours.
- Uploads are limited to 25 MB and allow only PDF, JPG, PNG, HEIC, DOC, and DOCX with matching extensions.
- Upload tokens are issued through an HttpOnly cookie on the Supabase Functions path, with a temporary form-token fallback for rollout.
- Documents have a `scan_status` contract. The launch stub marks files `skipped`; the UI blocks approval while scans are `pending`.
- Audit RPC validates entity/action names and redacts old email metadata through a retention function.
- `organizations.kind` is constrained to `admin` or `partner`.

## Operations

- Canonical production domain: `https://bizzlo.co`.
- Keep Cloudflare WAF, OWASP managed rules, Bot Fight Mode, and auth-path rate limits enabled.
- Keep Supabase public sign-ups disabled permanently.
- Store service-role keys only in local admin shells and Edge Function secrets.
- Rotate any exposed project URL/key pair before production if attribution matters.

## Incident Response

Follow `docs/INCIDENT_RESPONSE.md`. For suspected data access or upload abuse, immediately disable affected Edge Functions, revoke active student invites, review `audit_events`, and notify impacted partners.

