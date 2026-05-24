import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { seedCourses } from '../../src/data/seed.js';

const courseFinderPath = new URL('../../src/pages/CourseFinder.jsx', import.meta.url);

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
  assert.doesNotMatch(source, /await searchCourses\(/);
});

test('demo seed exports at least 40 partner course rows', () => {
  assert.ok(Array.isArray(seedCourses));
  assert.ok(seedCourses.length >= 40);
});
