import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inputPath = process.argv[2];
const outputPath = process.argv[3] || 'src/data/generatedCourseCatalog.js';

if (!inputPath) {
  console.error('Usage: node scripts/import-courses.mjs data-import/courses.csv [src/data/generatedCourseCatalog.js]');
  process.exit(1);
}

const requiredColumns = ['country', 'university', 'course', 'level'];
const columns = [
  'id',
  'catalog_key',
  'external_course_id',
  'source_name',
  'country',
  'city',
  'campus',
  'university',
  'level',
  'subject',
  'course',
  'credential',
  'duration',
  'mode',
  'intake',
  'tuition',
  'application_fee',
  'deadline',
  'partner_note',
  'eligibility',
  'english_requirement',
  'academic_requirement',
  'scholarship',
  'source_url',
  'source_updated_at',
  'is_verified',
];

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows.filter((item) => item.some(Boolean));
}

function normalizeLevel(level) {
  const value = String(level || '').toLowerCase();
  if (['ug', 'undergrad', 'undergraduate', 'bachelor', 'bachelors'].includes(value)) return 'Undergraduate';
  if (['pg', 'postgrad', 'postgraduate', 'master', 'masters'].includes(value)) return 'Postgraduate';
  return level || '';
}

function normalizeBoolean(value) {
  return ['1', 'true', 'yes', 'verified'].includes(String(value || '').toLowerCase());
}

function cleanRecord(record) {
  const next = {};

  for (const column of columns) {
    if (column === 'is_verified') {
      next[column] = normalizeBoolean(record[column]);
    } else {
      next[column] = record[column] || '';
    }
  }

  next.partner_note = next.partner_note || record.commission_hint || '';
  next.level = normalizeLevel(next.level);
  next.campus = next.campus || next.city;
  next.mode = next.mode || 'On campus';
  next.id = next.id || `course-${slug(`${next.country}-${next.university}-${next.course}-${next.intake}`)}`;
  next.catalog_key = next.catalog_key || [
    next.external_course_id ? 'external' : 'course',
    next.external_course_id || next.country,
    next.external_course_id ? next.source_name || next.source_url : next.university,
    next.external_course_id || next.course,
    next.level,
    next.intake,
    next.campus,
    next.credential,
    next.mode,
  ]
    .map((item) => String(item || '').trim().toLowerCase())
    .join('|');
  return next;
}

const source = readFileSync(resolve(inputPath), 'utf8');
const [headerRow, ...dataRows] = parseCsv(source);
const headers = headerRow.map((item) => item.trim().toLowerCase());
const missing = requiredColumns.filter((column) => !headers.includes(column));

if (missing.length) {
  console.error(`Missing required columns: ${missing.join(', ')}`);
  process.exit(1);
}

const records = dataRows.map((row, index) => {
  const raw = {};
  headers.forEach((header, columnIndex) => {
    raw[header] = row[columnIndex] || '';
  });

  const missingRequired = requiredColumns.filter((column) => !raw[column]);
  if (missingRequired.length) {
    throw new Error(`Row ${index + 2} missing ${missingRequired.join(', ')}`);
  }

  return cleanRecord(raw);
});

const duplicateIds = records
  .map((item) => item.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);

if (duplicateIds.length) {
  console.error(`Duplicate course ids found: ${[...new Set(duplicateIds)].join(', ')}`);
  process.exit(1);
}

const output = `export const generatedCourseCatalog = ${JSON.stringify(records, null, 2)};\n`;
writeFileSync(resolve(outputPath), output);

const byCountry = records.reduce((acc, record) => {
  acc[record.country] = (acc[record.country] || 0) + 1;
  return acc;
}, {});

console.log(`Imported ${records.length} courses into ${outputPath}`);
console.log(Object.entries(byCountry).map(([country, count]) => `${country}: ${count}`).join(', '));
