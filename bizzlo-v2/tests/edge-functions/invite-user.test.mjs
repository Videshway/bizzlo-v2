import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourcePath = new URL('../../supabase/functions/invite-user/index.ts', import.meta.url);

test('invite-user authorizes admin or owning manager only', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /adminProfile\.role === "super_admin"/);
  assert.match(source, /superAdminCount/);
  assert.match(source, /isManagerCreatingOwnCounselor/);
  assert.match(source, /You cannot create this account login\./);
});

test('invite-user validates account_request_id', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /account_request_id is required\./);
  assert.match(source, /account_request_id is required\." }, 400/);
});

test('invite-user creates a password login instead of sending invite email', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /createUser/);
  assert.match(source, /password: String\(password\)/);
  assert.match(source, /email_confirm: true/);
  assert.doesNotMatch(source, /inviteUserByEmail/);
  assert.doesNotMatch(source, /type: "recovery"/);
});

test('invite-user carries portal username into auth metadata and profile', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /normalizePortalUsername/);
  assert.match(source, /portalLoginEmail/);
  assert.match(source, /portal_username: portalUsername/);
  assert.match(source, /Account request has no valid portal username/);
});
