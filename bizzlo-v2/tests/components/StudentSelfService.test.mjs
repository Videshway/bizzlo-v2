import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourcePath = new URL('../../src/pages/StudentSelfService.jsx', import.meta.url);

test('student portal does not persist upload tokens in browser storage', async () => {
  const source = await readFile(sourcePath, 'utf8');
  assert.doesNotMatch(source, /sessionStorage|localStorage/);
});

test('student portal renders Turnstile before OTP request', async () => {
  const source = await readFile(sourcePath, 'utf8');
  assert.match(source, /VITE_TURNSTILE_SITE_KEY/);
  assert.match(source, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(source, /action: 'request_otp'/);
});

test('student portal verifies OTP before showing uploader', async () => {
  const source = await readFile(sourcePath, 'utf8');
  assert.match(source, /action: 'verify_otp'/);
  assert.match(source, /verified: true/);
  assert.match(source, /Upload document/);
});

test('student portal upload uses credentials for HttpOnly cookie flow', async () => {
  const source = await readFile(sourcePath, 'utf8');
  assert.match(source, /credentials: 'include'/);
  assert.match(source, /student-upload-document/);
});
