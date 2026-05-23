import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourcePath = new URL('../../src/components/AuthScreen.jsx', import.meta.url);

test('AuthScreen renders the sign-in workspace copy', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /Sign in to your workspace/);
  assert.match(source, /Public sign-up stays closed/);
});

test('AuthScreen submits credentials through signIn', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /await signIn\(form\.email, form\.password\)/);
  assert.match(source, /type="email"/);
  assert.match(source, /type="password"/);
});

test('AuthScreen exposes password reset through resetPassword', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /await resetPassword\(form\.email\)/);
  assert.match(source, /Send password reset/);
});
