import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const teamPath = new URL('../../src/pages/Team.jsx', import.meta.url);
const dashboardPath = new URL('../../src/pages/Dashboard.jsx', import.meta.url);

test('Team lets admin allocate partner portal username and email', async () => {
  const source = await readFile(teamPath, 'utf8');

  assert.match(source, /Portal username/);
  assert.match(source, /Initial password/);
  assert.match(source, /portal_username/);
  assert.match(source, /Manager email/);
  assert.match(source, /Videshway Account Login Board/);
  assert.match(source, /One-Time Login Receipts/);
});

test('Dashboard shows admin partner portal access board', async () => {
  const source = await readFile(dashboardPath, 'utf8');

  assert.match(source, /Partner Portal Access Board/);
  assert.match(source, /Username:/);
  assert.match(source, /Email:/);
});
