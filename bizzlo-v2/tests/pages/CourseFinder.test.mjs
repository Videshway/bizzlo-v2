import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { seedCourses } from '../../src/data/seed.js';

const courseFinderPath = new URL('../../src/pages/CourseFinder.jsx', import.meta.url);
const applicationsPath = new URL('../../src/pages/Applications.jsx', import.meta.url);
const documentsPath = new URL('../../src/pages/Documents.jsx', import.meta.url);

test('CourseFinder shows the production empty catalogue state', async () => {
  const source = await readFile(courseFinderPath, 'utf8');
  assert.match(source, /isSupabaseConfigured/);
  assert.match(source, /Course catalogue not seeded yet/);
});

test('CourseFinder verified stats use the explicit verified flag', async () => {
  const source = await readFile(courseFinderPath, 'utf8');
  assert.match(source, /is_verified === true/);
});

test('CourseFinder debounces search updates by 250ms', async () => {
  const source = await readFile(courseFinderPath, 'utf8');
  assert.match(source, /setTimeout\([\s\S]*250\)/);
});

test('CourseFinder exposes all partner countries without forcing the full catalogue into the browser', async () => {
  const source = await readFile(courseFinderPath, 'utf8');
  assert.match(source, /partnerPdfCountries/);
  assert.match(source, /United Kingdom/);
  assert.match(source, /United States/);
  assert.match(source, /Dubai/);
  assert.match(source, /countries available/);
  assert.match(source, /loadCourseCatalogCount/);
  assert.doesNotMatch(source, /loadFullCourseCatalog\?\.\(\)/);
  assert.doesNotMatch(source, /Loading full partner catalogue/);
  assert.doesNotMatch(source, /Full catalogue has/);
  assert.doesNotMatch(source, /Load full catalogue/);
});

test('CourseFinder searches live catalog first while the full catalog fills in', async () => {
  const source = await readFile(courseFinderPath, 'utf8');
  assert.match(source, /searchCoursesRef/);
  assert.match(source, /runLiveSearch\(\{/);
  assert.match(source, /liveSearchPageSize = 100/);
  assert.match(source, /Load more live results/);
  assert.match(source, /append: true/);
  assert.match(source, /\[country, intakeFilter, level, query\]/);
  assert.match(source, /Apply to selected/);
  assert.match(source, /Choose a student profile before applying/);
  assert.match(source, /courseTuitionLabel/);
  assert.match(source, /courseDeadlineLabel/);
});

test('demo seed exports at least 40 partner course rows', () => {
  assert.ok(Array.isArray(seedCourses));
  assert.ok(seedCourses.length >= 40);
});

test('Applications new application modal supports typed student lookup', async () => {
  const source = await readFile(applicationsPath, 'utf8');
  assert.match(source, /list="application-student-options"/);
  assert.match(source, /findStudentFromInput/);
  assert.match(source, /Type student name, email, or code/);
  assert.doesNotMatch(source, /value=\{form\.student_id \|\| visibleStudents\[0\]\?\.id \|\| ''\}/);
});

test('Documents page refreshes admin queue and surfaces download errors', async () => {
  const source = await readFile(documentsPath, 'utf8');

  assert.match(source, /refreshDocuments/);
  assert.match(source, /useEffect\(\(\) => \{\s*refreshDocuments\?\.\(\)\.catch/);
  assert.match(source, /setDownloadError/);
  assert.doesNotMatch(source, /handleDownload\(documentRow\.id\)\.catch\(\(\) => \{\}\)/);
});

test('Documents page prepares downloads from the user click before signed-url lookup finishes', async () => {
  const source = await readFile(documentsPath, 'utf8');

  assert.match(source, /window\.open\('about:blank', '_blank'\)/);
  assert.match(source, /triggerDownload\(download, preparedWindow\)/);
  assert.match(source, /preparedWindow\.location\.href = url/);
});
