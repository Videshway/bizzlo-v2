import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const batchSize = Number(process.env.COURSE_SEED_BATCH_SIZE || 500);

const dataFiles = [
  'private-data/partner-course-templates.json',
];

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function courseKey(course) {
  if (course.catalog_key) return normalize(course.catalog_key).toLowerCase();
  if (course.external_course_id) {
    return ['external', course.source_name || course.source_url || 'source', course.external_course_id]
      .map((value) => normalize(value).toLowerCase())
      .join('|');
  }
  return [
    course.country,
    course.university,
    course.course,
    course.level,
    course.intake,
    course.campus,
    course.credential,
    course.mode,
  ]
    .map((value) => normalize(value).toLowerCase())
    .join('|');
}

function normalizeDate(value) {
  const text = normalize(value);
  const euDate = text.match(/^(\d{2})-(\d{2})-(20\d{2})$/);
  if (euDate) return `${euDate[3]}-${euDate[2]}-${euDate[1]}`;
  if (/^20\d{2}-\d{2}-\d{2}$/.test(text)) return text;
  return new Date().toISOString().slice(0, 10);
}

function payload(course) {
  return {
    catalog_key: courseKey(course),
    external_course_id: normalize(course.external_course_id),
    source_name: normalize(course.source_name),
    university: normalize(course.university),
    country: normalize(course.country),
    city: normalize(course.city),
    campus: normalize(course.campus || course.city),
    level: normalize(course.level),
    subject: normalize(course.subject),
    course: normalize(course.course),
    credential: normalize(course.credential),
    duration: normalize(course.duration),
    mode: normalize(course.mode) || 'On campus',
    intake: normalize(course.intake),
    tuition: normalize(course.tuition),
    application_fee: normalize(course.application_fee),
    deadline: normalize(course.deadline),
    commission_hint: normalize(course.partner_note || course.commission_hint),
    eligibility_notes: normalize(course.eligibility || course.eligibility_notes) || 'Review eligibility',
    english_requirement: normalize(course.english_requirement),
    academic_requirement: normalize(course.academic_requirement),
    scholarship: normalize(course.scholarship),
    source_url: normalize(course.source_url),
    source_updated_at: normalizeDate(course.source_updated_at),
    is_verified: Boolean(course.is_verified),
    is_active: true,
  };
}

function readRows(file) {
  const fullPath = path.join(root, file);
  if (!existsSync(fullPath)) return [];
  const rows = JSON.parse(readFileSync(fullPath, 'utf8'));
  if (!Array.isArray(rows)) throw new Error(`${file} is not a JSON array`);
  return rows;
}

function chunk(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const byKey = new Map();
for (const file of dataFiles) {
  for (const course of readRows(file)) {
    const row = payload(course);
    if (row.country && row.university && row.course && row.level) byKey.set(row.catalog_key, row);
  }
}

const rows = [...byKey.values()];
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const { error: deactivateError } = await supabase
  .from('courses')
  .update({ is_active: false })
  .not('id', 'is', null);

if (deactivateError) throw deactivateError;
console.log('Deactivated existing course rows before partner-catalog seed.');

let imported = 0;
for (const group of chunk(rows, batchSize)) {
  const { error } = await supabase.from('courses').upsert(group, { onConflict: 'catalog_key' });
  if (error) throw error;
  imported += group.length;
  console.log(`Upserted ${imported.toLocaleString()} / ${rows.length.toLocaleString()} courses`);
}

console.log(`Course seed complete: ${rows.length.toLocaleString()} active catalogue rows.`);
