# Incident Response

## Severity

- SEV-1: suspected data leak, unauthorized document access, compromised admin, or production outage.
- SEV-2: upload abuse, failed invite/OTP flow, broken partner login, or degraded database performance.
- SEV-3: isolated UI bug or single-user workflow failure.

## First 30 Minutes

1. Assign an incident lead.
2. Freeze deploys except fixes.
3. Capture the timeline in a shared document.
4. If security-related, disable affected Edge Functions or revoke affected sessions/invites.
5. Update `https://status.bizzlo.co`.

## Recovery

- Roll back frontend through Vercel.
- Redeploy Edge Functions from the last known-good source.
- Restore Supabase backup into staging first, verify RLS with `npm run db:check-rls`, then restore production only if required.

## Postmortem

Record customer impact, root cause, detection gap, fix, owner, and due date. Review within 72 hours.

