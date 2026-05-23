import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('CSP excludes unsafe inline and eval while allowing Turnstile', async () => {
  const source = await readFile(new URL('../../../vercel.json', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /unsafe-inline|unsafe-eval/);
  assert.match(source, /challenges\.cloudflare\.com/);
});

test('env example documents launch security keys', async () => {
  const source = await readFile(new URL('../../.env.example', import.meta.url), 'utf8');
  assert.match(source, /VITE_TURNSTILE_SITE_KEY/);
  assert.match(source, /TURNSTILE_SECRET_KEY/);
  assert.match(source, /RESEND_API_KEY/);
  assert.match(source, /VITE_SENTRY_DSN/);
  assert.match(source, /VITE_POSTHOG_KEY/);
});

test('deployment docs include branch protection and all launch migrations', async () => {
  const source = await readFile(new URL('../../docs/DEPLOYMENT.md', import.meta.url), 'utf8');
  assert.match(source, /001-010/);
  assert.match(source, /Branch protection/);
});

test('data rights docs and security docs are present', async () => {
  const security = await readFile(new URL('../../docs/SECURITY.md', import.meta.url), 'utf8');
  const exportDoc = await readFile(new URL('../../docs/DATA_EXPORT.md', import.meta.url), 'utf8');
  const deletionDoc = await readFile(new URL('../../docs/DATA_DELETION.md', import.meta.url), 'utf8');
  assert.match(security, /Threat Model/);
  assert.match(exportDoc, /export-organization-data/);
  assert.match(deletionDoc, /purge-student/);
});
