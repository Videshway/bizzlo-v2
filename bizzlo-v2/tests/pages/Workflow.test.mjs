import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const shellPath = new URL('../../src/components/Shell.jsx', import.meta.url);
const applicationsPath = new URL('../../src/pages/Applications.jsx', import.meta.url);
const dashboardPath = new URL('../../src/pages/Dashboard.jsx', import.meta.url);
const appStatePath = new URL('../../src/lib/appState.jsx', import.meta.url);
const migration13Path = new URL('../../supabase/migrations/013_partner_status_handoff.sql', import.meta.url);

test('launch menu keeps Support and hides non-core sections', async () => {
  const source = await readFile(shellPath, 'utf8');

  assert.match(source, /label: 'Support'/);
  assert.doesNotMatch(source, /label: '360 Solutions'/);
  assert.doesNotMatch(source, /label: 'Tasks'/);
  assert.doesNotMatch(source, /label: 'Intake'/);
});

test('alerts are practical role-aware application and document updates', async () => {
  const source = await readFile(shellPath, 'utf8');

  assert.match(source, /Partner sent documents for admin decision/);
  assert.match(source, /Admin requested changes/);
  assert.match(source, /Admin update:/);
  assert.match(source, /Document waiting for admin approval/);
  assert.match(source, /Admin rejected this document/);
  assert.match(source, /visibleApplicationNotes/);
});

test('dashboard quick actions no longer advertise hidden 360 resources', async () => {
  const source = await readFile(dashboardPath, 'utf8');

  assert.match(source, /action\.id !== 'resources'/);
  assert.match(source, /Open students/);
  assert.doesNotMatch(source, /Start intake/);
});

test('partners send uploaded documents to admin instead of selecting admin stages', async () => {
  const source = await readFile(applicationsPath, 'utf8');

  assert.match(source, /Send to admin/);
  assert.match(source, /partnerSubmitStatuses/);
  assert.match(source, /hasSubmittedDocuments/);
  assert.match(source, /updateApplicationStatus\(selectedApplication\.id, 'ready_for_admin_review'\)/);
  assert.match(source, /Videshway admin controls the next movement/);
});

test('app state blocks partner jumps after admin owns a file and creates timeline notes', async () => {
  const source = await readFile(appStatePath, 'utf8');

  assert.match(source, /This file is already with Videshway admin/);
  assert.match(source, /Upload at least one student document before sending/);
  assert.match(source, /Partner submitted uploaded documents for Videshway admin review/);
  assert.match(source, /Videshway admin updated this application to/);
  assert.doesNotMatch(source, /'pending_admin_review',\n\s*'admin_changes_requested'/);
});

test('013 migration locks partner status handoff at the database layer', async () => {
  const source = await readFile(migration13Path, 'utf8');

  assert.match(source, /applications update through student/);
  assert.match(source, /ready_for_admin_review/);
  assert.doesNotMatch(source, /pending_admin_review/);
  assert.doesNotMatch(source, /submitted_to_university/);
});
