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

test('sign in tries portal username fallback for email identifiers', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /function loginEmailCandidatesForIdentifier/);
  assert.match(source, /portalLoginEmail\(email\.split\('@'\)\[0\]\)/);
  assert.match(source, /for \(const loginEmail of loginCandidates\)/);
});

test('Course Finder full catalogue loads in pages without shrinking sync data', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /const courseCatalogPageSize = 5000/);
  assert.match(source, /const courseCatalogUiFlushRows = 5000/);
  assert.match(source, /const loadCourseCatalogCount = useCallback/);
  assert.match(source, /async \(options = \{\}\) =>/);
  assert.match(source, /mergeCourseRows\(current, rowsToFlush\)/);
  assert.match(source, /filters\.append \? mergeCourseRows\(current, mapped\) : mapped/);
  assert.match(source, /effectivePageSize = mappedRows\.length/);
});

test('Course Finder initial sync uses balanced live search instead of arbitrary first rows', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /supabase\.rpc\('search_courses'/);
  assert.match(source, /filter_intake: 'September'/);
  assert.doesNotMatch(source, /from\('courses'\)\.select\('\*'\)\.eq\('is_active', true\)\.limit\(100\)/);
});

test('new student codes do not reuse the visible student count', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /function makeStudentCode/);
  assert.match(source, /students_student_code_key/);
  assert.doesNotMatch(source, /students\.length \+ 1/);
});

test('course apply returns without waiting for a full dashboard refresh', async () => {
  const source = await readFile(sourcePath, 'utf8');
  const addApplicationBlock = source.match(/async function addApplication[\s\S]*?async function addCourse/)?.[0] || '';

  assert.match(addApplicationBlock, /setApplications\(\(prev\) => \[data, \.\.\.prev\]\)/);
  assert.match(addApplicationBlock, /refreshDataRef\.current\(\)\.catch/);
  assert.doesNotMatch(addApplicationBlock, /await refreshData\(\)/);
});

test('production state does not boot with demo profile IDs', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /useState\(isDemoMode \? seedStudents : \[\]\)/);
  assert.match(source, /useState\(isDemoMode \? seedUsers : \[\]\)/);
  assert.match(source, /useState\(isDemoMode \? seedApplications : \[\]\)/);
  assert.doesNotMatch(source, /useState\(seedStudents\)/);
  assert.doesNotMatch(source, /useState\(seedUsers\)/);
});

test('application creation strips demo ids before Supabase insert', async () => {
  const source = await readFile(sourcePath, 'utf8');
  const addApplicationBlock = source.match(/async function addApplication[\s\S]*?async function addCourse/)?.[0] || '';

  assert.match(addApplicationBlock, /!isUuid\(application\.student_id\)/);
  assert.match(addApplicationBlock, /uuidOrNull\(student\?\.manager_id\)/);
  assert.match(addApplicationBlock, /uuidOrNull\(student\?\.counselor_id\)/);
  assert.doesNotMatch(addApplicationBlock, /manager_id: student\?\.manager_id \|\| currentUser\.id/);
  assert.doesNotMatch(addApplicationBlock, /counselor_id: student\?\.counselor_id \|\| currentUser\.id/);
});

test('document refresh is targeted for admin review queues', async () => {
  const source = await readFile(sourcePath, 'utf8');

  assert.match(source, /const loadDocuments = useCallback/);
  assert.match(source, /refreshDocumentsRef/);
  assert.match(source, /scheduleDocumentsRefresh/);
  assert.match(source, /refreshDocuments: loadDocuments/);
  assert.match(source, /\.from\('documents'\)[\s\S]*?\.range\(0, 249\)/);
});

test('document signed-url downloads are not blocked by audit logging', async () => {
  const source = await readFile(sourcePath, 'utf8');
  const downloadBlock = source.match(/async function getDocumentDownloadUrl[\s\S]*?async function updateCommission/)?.[0] || '';

  assert.match(downloadBlock, /\.createSignedUrl/);
  assert.match(downloadBlock, /logAuditEvent\('documents', documentId, 'document_downloaded'[\s\S]*?\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(downloadBlock, /await logAuditEvent\('documents'/);
});
