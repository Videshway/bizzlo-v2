import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const redeemPath = new URL('../../supabase/functions/redeem-student-invite/index.ts', import.meta.url);
const uploadPath = new URL('../../supabase/functions/student-upload-document/index.ts', import.meta.url);
const sharedPath = new URL('../../supabase/functions/_shared/security.ts', import.meta.url);

test('redeem-student-invite supports OTP request and verify actions', async () => {
  const source = await readFile(redeemPath, 'utf8');
  assert.match(source, /request_otp/);
  assert.match(source, /verify_otp/);
  assert.match(source, /student_portal_otps/);
});

test('redeem-student-invite blocks invite after repeated wrong OTP', async () => {
  const source = await readFile(redeemPath, 'utf8');
  assert.match(source, /nextAttempts >= Number\(otp\.max_attempts/);
  assert.match(source, /status: "blocked"/);
});

test('redeem-student-invite rate-limits requests', async () => {
  const source = await readFile(redeemPath, 'utf8');
  assert.match(source, /checkRateLimit\(client, request, "redeem-student-invite", 10\)/);
  assert.match(source, /429/);
});

test('redeem-student-invite sets an upload cookie', async () => {
  const source = await readFile(redeemPath, 'utf8');
  assert.match(source, /Set-Cookie/);
  assert.match(source, /portalCookie\(uploadToken\)/);
});

test('student-upload-document enforces size and MIME checks', async () => {
  const source = await readFile(uploadPath, 'utf8');
  assert.match(source, /25 \* 1024 \* 1024/);
  assert.match(source, /allowedTypes/);
  assert.match(source, /422/);
});

test('student-upload-document claims upload count atomically', async () => {
  const source = await readFile(uploadPath, 'utf8');
  assert.match(source, /claim_student_portal_upload/);
  assert.match(source, /410/);
});

test('student-upload-document reads HttpOnly cookie with form fallback', async () => {
  const source = await readFile(uploadPath, 'utf8');
  assert.match(source, /cookieValue\(request, "bizzlo_portal"\) \|\| String\(formData\.get\("token"\)/);
});

test('shared security validates Turnstile and rate buckets', async () => {
  const source = await readFile(sharedPath, 'utf8');
  assert.match(source, /siteverify/);
  assert.match(source, /edge_check_rate_limit/);
  assert.match(source, /max_count/);
  assert.match(source, /https:\/\/www\.bizzlo\.co/);
});

test('shared security cookie is HttpOnly and Secure', async () => {
  const source = await readFile(sharedPath, 'utf8');
  assert.match(source, /HttpOnly/);
  assert.match(source, /Secure/);
  assert.match(source, /Max-Age=7200/);
});
