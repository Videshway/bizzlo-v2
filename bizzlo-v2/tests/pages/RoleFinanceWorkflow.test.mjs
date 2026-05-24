import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rolesPath = new URL('../../src/lib/roles.js', import.meta.url);
const shellPath = new URL('../../src/components/Shell.jsx', import.meta.url);
const commissionsPath = new URL('../../src/pages/Commissions.jsx', import.meta.url);
const appStatePath = new URL('../../src/lib/appState.jsx', import.meta.url);
const migration15Path = new URL('../../supabase/migrations/015_super_admin_finance_workflow.sql', import.meta.url);

test('role helpers split super admin finance from admissions admin', async () => {
  const source = await readFile(rolesPath, 'utf8');

  assert.match(source, /super_admin/);
  assert.match(source, /canManageFinance/);
  assert.match(source, /canManagePartners/);
  assert.match(source, /!hasSuperAdmin/);
});

test('navigation keeps finance and partner setup behind owner controls', async () => {
  const source = await readFile(shellPath, 'utf8');

  assert.match(source, /canManageFinance\(currentUser, users\)/);
  assert.match(source, /canManagePartners\(currentUser, users\)/);
  assert.match(source, /roles: \['super_admin', 'admin', 'manager', 'counselor'\]/);
});

test('finance page supports manager invoice submit and super admin review', async () => {
  const source = await readFile(commissionsPath, 'utf8');

  assert.match(source, /submitCommissionInvoice/);
  assert.match(source, /reviewCommissionInvoice/);
  assert.match(source, /Accept invoice/);
  assert.match(source, /Invoice reason/);
  assert.match(source, /Payout approved/);
});

test('app state attaches course applications to synced students and never creates duplicate students from Course Finder', async () => {
  const source = await readFile(appStatePath, 'utf8');

  assert.match(source, /Choose a synced student profile before creating the application/);
  assert.match(source, /course_id: isUuid\(application\.course_id\) \? application\.course_id : null/);
  assert.match(source, /const student = students\.find\(\(item\) => item\.id === application\.student_id\)/);
  assert.doesNotMatch(source.match(/async function addApplication[\s\S]*?async function addCourse/)?.[0] || '', /addStudent/);
});

test('super admin migration widens application admin access but keeps payout review owner-controlled', async () => {
  const source = await readFile(migration15Path, 'utf8');

  assert.match(source, /can_manage_owner_controls/);
  assert.match(source, /invoice_status/);
  assert.match(source, /payout_status/);
  assert.match(source, /guard_commission_finance_update/);
  assert.match(source, /Partner managers can only submit invoice details/);
});
