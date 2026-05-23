import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourcePath = new URL('../../supabase/functions/invite-user/index.ts', import.meta.url);

test('invite-user rejects non-admin callers', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /adminProfile\?\.role !== "admin"/);
  assert.match(source, /Only Videshway admin can send account invites\./);
});

test('invite-user validates account_request_id', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /account_request_id is required\./);
  assert.match(source, /account_request_id is required\." }, 400/);
});

test('invite-user sends Supabase invite email instead of recovery links', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /inviteUserByEmail/);
  assert.doesNotMatch(source, /type: "recovery"/);
  assert.match(source, /redirectTo: `\$\{siteUrl\}\/`/);
});
