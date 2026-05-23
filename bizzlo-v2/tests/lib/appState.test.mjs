import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourcePath = new URL('../../src/lib/appState.jsx', import.meta.url);

test('addApplicationNote persists application events with the current actor', async () => {
  const source = await readFile(sourcePath, 'utf8');
  const addNoteBlock = source.match(new RegExp('async function addApplicationNote[\\s\\S]*?return note;\\n\\s{2}}'))?.[0] || '';

  assert.match(addNoteBlock, /\.from\('application_events'\)/);
  assert.match(addNoteBlock, /actor_id: currentUser\.id/);
  assert.match(addNoteBlock, /note: body/);
});

test('closeTask updates local task state optimistically in demo mode', async () => {
  const source = await readFile(sourcePath, 'utf8');
  const closeTaskBlock = source.match(/async function closeTask[\s\S]*?async function addServiceRequest/)?.[0] || '';

  assert.match(closeTaskBlock, /if \(!isSupabaseConfigured\)/);
  assert.match(closeTaskBlock, /setTasks\(\(prev\) => prev\.map/);
  assert.match(closeTaskBlock, /status: 'done'/);
});

test('student invite links point to the public portal route', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /\/portal\/\$\{code\}\?token=/);
  assert.match(source, /\.from\('student_invites'\)\.insert/);
});
