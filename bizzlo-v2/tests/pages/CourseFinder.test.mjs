import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { seedCourses } from '../../src/data/seed.js';

const courseFinderPath = new URL('../../src/pages/CourseFinder.jsx', import.meta.url);
const applicationsPath = new URL('../../src/pages/Applications.jsx', import.meta.url);

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

test('CourseFinder loads the full catalog outside dashboard sync', async () => {
  const source = await readFile(courseFinderPath, 'utf8');
  assert.match(source, /loadFullCourseCatalog/);
  assert.match(source, /loadCourseCatalogCount/);
  assert.match(source, /Full catalogue has/);
  assert.doesNotMatch(source, /await searchCourses\(/);
  assert.doesNotMatch(source, /useEffect\(\(\) => \{\s*loadFullCourseCatalog\?\.\(\)/);
});

test('CourseFinder searches live catalog without forcing all rows into the browser', async () => {
  const source = await readFile(courseFinderPath, 'utf8');
  assert.match(source, /await searchCourses\?\.\(\{/);
  assert.match(source, /liveSearchPageSize = 100/);
  assert.match(source, /Load more live results/);
  assert.match(source, /append: true/);
  assert.match(source, /Apply to selected/);
  assert.match(source, /Choose a student profile before applying/);
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
