function catalogKey(course) {
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

function dedupeCatalog(rows) {
  const seen = new Set();
  return rows.filter((course) => {
    const key = catalogKey(course);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeCourseCatalog(officialRows, partnerRows = []) {
  const usablePartnerRows = Array.isArray(partnerRows) ? partnerRows : [];
  const legacyPartnerRows = Array.isArray(officialRows)
    ? officialRows.filter((course) => Boolean(course.partner_university_id) || /partner september 2026/i.test(course.source_name || ''))
    : [];

  return dedupeCatalog([...usablePartnerRows, ...legacyPartnerRows]);
}

export async function loadOfficialCourseCatalog() {
  return [];
}

export async function loadCountryCourseCatalog() {
  return [];
}
