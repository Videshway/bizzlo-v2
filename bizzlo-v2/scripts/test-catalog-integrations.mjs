import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { seedCourses } from '../src/data/seed.js';

const requiredFields = ['country', 'university', 'course', 'level'];
const forbiddenFinancialField = /(commission|gross|net|rate|payout|aoa|coa|fixed|share|basis)/i;

function sourceKey(course) {
  if (course.catalog_key) return String(course.catalog_key).trim().toLowerCase();
  if (course.external_course_id) {
    return ['external', course.source_name || course.source_url || 'source', course.external_course_id]
      .map((value) => String(value || '').trim().toLowerCase())
      .join('|');
  }
  if (course.id && !String(course.id).includes('null')) return `source-row|${String(course.id).trim().toLowerCase()}`;

  return [course.country, course.university, course.course, course.level, course.intake, course.campus, course.credential, course.mode]
    .map((value) => String(value || '').trim().toLowerCase())
    .join('|');
}

async function fileExists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJsonRows(path) {
  if (!(await fileExists(path))) {
    return { path, exists: false, rows: [], errors: [`Missing ${path}`] };
  }

  try {
    const rows = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(rows)) {
      return { path, exists: true, rows: [], errors: [`${path} is not an array`] };
    }
    return { path, exists: true, rows, errors: [] };
  } catch (error) {
    return { path, exists: true, rows: [], errors: [`${path} cannot be parsed: ${error.message}`] };
  }
}

function validateRows(path, rows) {
  const errors = [];
  const warnings = [];
  const keys = new Set();
  let complete = 0;
  let verified = 0;

  rows.forEach((row, index) => {
    if (path.includes('partner-course-templates')) {
      const forbiddenKeys = Object.keys(row).filter((key) => forbiddenFinancialField.test(key));
      if (forbiddenKeys.length) {
        errors.push(`${path} row ${index + 1} includes forbidden commercial field(s): ${forbiddenKeys.join(', ')}`);
        return;
      }
    }

    const missing = requiredFields.filter((field) => !row[field]);
    if (missing.length) {
      errors.push(`${path} row ${index + 1} missing ${missing.join(', ')}`);
      return;
    }

    complete += 1;
    if (row.is_verified) verified += 1;
    const key = sourceKey(row);
    if (keys.has(key)) warnings.push(`${path} duplicate key ${key}`);
    keys.add(key);
  });

  return {
    errors,
    warnings,
    complete,
    verified,
    duplicateCount: Math.max(0, rows.length - keys.size),
  };
}

const localFiles = [
  'private-data/partner-course-templates.json',
];

const localResults = [];
for (const file of localFiles) {
  const result = await readJsonRows(file);
  const validation = validateRows(file, result.rows);
  localResults.push({ ...result, ...validation });
}

const totalRows = localResults.reduce((total, result) => total + result.rows.length, 0);
const totalVerified = localResults.reduce((total, result) => total + result.verified, 0);
const missingPrivateData = localResults.every((result) => !result.exists);
const demoValidation = validateRows('src/data/seed.js seedCourses', seedCourses);
const localErrors = missingPrivateData ? [] : localResults.flatMap((result) => [...result.errors.slice(0, 8)]);
const localWarnings = localResults.flatMap((result) => [...result.warnings.slice(0, 8)]);
const hardErrors = [...localErrors, ...demoValidation.errors.slice(0, 8)];

if (missingPrivateData && seedCourses.length < 40) {
  hardErrors.push('src/data/seed.js seedCourses must contain at least 40 rows when private-data is absent');
}

console.log('Bizzlo partner catalogue test');
console.log('Mode: offline partner-PDF file validation');
console.log(`Partner PDF rows validated: ${totalRows.toLocaleString()}`);
console.log(`Partner PDF rows flagged verified: ${totalVerified.toLocaleString()}`);
console.log('');

console.log('Local data files');
for (const result of localResults) {
  console.log(`- ${result.path}: ${result.exists ? result.rows.length.toLocaleString() : 'missing'} rows, ${result.errors.length} error(s), ${result.duplicateCount} duplicate warning(s)`);
}

if (missingPrivateData) {
  console.log(`- src/data/seed.js seedCourses: ${seedCourses.length.toLocaleString()} rows, ${demoValidation.errors.length} error(s), ${demoValidation.duplicateCount} duplicate warning(s)`);
  console.log('');
  console.log('Note: private partner catalogue is intentionally absent in clean source checkouts; deploy builds validate the demo seed and production is seeded from the private local file.');
}

if (hardErrors.length) {
  console.log('');
  console.log('Failures');
  hardErrors.slice(0, 20).forEach((error) => console.log(`- ${error}`));
  process.exit(1);
}

if (localWarnings.length) {
  console.log('');
  console.log('Warnings');
  localWarnings.slice(0, 20).forEach((warning) => console.log(`- ${warning}`));
}

console.log('');
console.log('PASS: partner PDF catalogue fields are valid and commercial-rate fields are not present.');
