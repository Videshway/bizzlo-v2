import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration7 = new URL('../../supabase/migrations/007_portal_otp.sql', import.meta.url);
const migration8 = new URL('../../supabase/migrations/008_security_plumbing.sql', import.meta.url);
const migration9 = new URL('../../supabase/migrations/009_indexes_and_cron.sql', import.meta.url);
const migration10 = new URL('../../supabase/migrations/010_data_rights.sql', import.meta.url);
const migration11 = new URL('../../supabase/migrations/011_partner_portal_identity.sql', import.meta.url);
const migration12 = new URL('../../supabase/migrations/012_rate_limit_bucket_fix.sql', import.meta.url);

test('007 creates OTP and throttle tables', async () => {
  const source = await readFile(migration7, 'utf8');
  assert.match(source, /student_portal_otps/);
  assert.match(source, /request_throttle/);
  assert.match(source, /edge_check_rate_limit/);
});

test('007 adds upload caps to student portal sessions', async () => {
  const source = await readFile(migration7, 'utf8');
  assert.match(source, /upload_count/);
  assert.match(source, /max_uploads/);
  assert.match(source, /claim_student_portal_upload/);
});

test('008 adds document scan contract and organization kind guard', async () => {
  const source = await readFile(migration8, 'utf8');
  assert.match(source, /scan_status/);
  assert.match(source, /organizations_kind_check/);
});

test('008 validates audit entity and action names', async () => {
  const source = await readFile(migration8, 'utf8');
  assert.match(source, /allowed_entities/);
  assert.match(source, /\^\[a-z\]\[a-z0-9_\]\{0,63\}\$/);
});

test('008 redacts old email audit metadata', async () => {
  const source = await readFile(migration8, 'utf8');
  assert.match(source, /redact_old_audit_metadata/);
  assert.match(source, /email_sha256/);
});

test('009 adds launch-scale indexes and search RPC', async () => {
  const source = await readFile(migration9, 'utf8');
  assert.match(source, /idx_applications_org_status_updated/);
  assert.match(source, /search_courses/);
});

test('009 schedules cleanup hooks when pg_cron is available', async () => {
  const source = await readFile(migration9, 'utf8');
  assert.match(source, /bizzlo-nightly-portal-cleanup/);
  assert.match(source, /student_portal_otps/);
  assert.match(source, /request_throttle/);
});

test('010 creates erasure event tracking', async () => {
  const source = await readFile(migration10, 'utf8');
  assert.match(source, /data_erasure_events/);
  assert.match(source, /target_type/);
});

test('011 stores partner portal usernames on requests and profiles', async () => {
  const source = await readFile(migration11, 'utf8');
  assert.match(source, /portal_username/);
  assert.match(source, /idx_profiles_portal_username_unique/);
  assert.match(source, /account_requests_portal_username_format/);
});

test('012 fixes ambiguous rate limit bucket references', async () => {
  const source = await readFile(migration12, 'utf8');
  assert.match(source, /p_bucket text/);
  assert.match(source, /values \(p_bucket, current_window, 1\)/);
  assert.doesNotMatch(source, /values \(bucket, current_window, 1\)/);
});
