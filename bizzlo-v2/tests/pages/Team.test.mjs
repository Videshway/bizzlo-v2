import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canManagePartners } from '../../src/lib/roles.js';

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

test('Dashboard keeps partner account status and access behind the partner permission gate', async () => {
  const source = await readFile(dashboardPath, 'utf8');

  assert.match(source, /const partnerOwner = canManagePartners\(currentUser, users\)/);
  assert.match(source, /\{partnerOwner \? <Panel className="dashboard-partners-panel"/);
  assert.match(source, /title="Partner workspace access"/);
  assert.match(source, /onNavigate\('team'\)[\s\S]*?Manage partners/);
  assert.match(source, /counselor seats/);
  assert.match(source, /<StatusBadge value=\{manager \? 'active' : request\?\.status/);
});

test('partner access remains limited to the super admin or legacy admin owner', () => {
  const superAdmin = { id: 'owner', role: 'super_admin' };
  const admin = { id: 'operations', role: 'admin' };
  const users = [superAdmin, admin];

  assert.equal(canManagePartners(superAdmin, users), true);
  assert.equal(canManagePartners(admin, users), false);
  assert.equal(canManagePartners({ role: 'manager' }, users), false);
  assert.equal(canManagePartners({ role: 'counselor' }, users), false);
  assert.equal(canManagePartners(admin, [admin]), true);
  assert.equal(canManagePartners(null, users), false);
});
