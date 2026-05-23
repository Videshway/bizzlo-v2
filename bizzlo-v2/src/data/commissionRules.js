function staticUrl(path) {
  return `${import.meta.env.BASE_URL || '/'}${path.replace(/^\//, '')}`;
}

let commissionRulesPromise = null;

export let commissionYears = ['All'];

export let commissionIntakes = ['All'];

export const commissionImportColumns = [
  'country',
  'sourceCountry',
  'year',
  'intake',
  'university',
  'studyLevel',
  'eligibilityStatus',
  'hasRestrictions',
  'updatedAt',
];

export let commissionStructureRows = [];

export const alliedServiceRows = [
  { id: 'loan', category: 'Education Loan', partner: 'Loan Desk', commercialHandling: 'Finance controlled', trigger: 'Loan disbursal', terms: 'Payable only after lender confirmation and student consent.' },
  { id: 'accommodation', category: 'Accommodations', partner: 'Housing Desk', commercialHandling: 'Finance controlled', trigger: 'Booking confirmed', terms: 'Partner credit is reviewed after check-in and provider confirmation.' },
  { id: 'sim', category: 'SIM Card', partner: 'Arrival Services', commercialHandling: 'Finance controlled', trigger: 'SIM activated', terms: 'Only eligible for activated student SIMs.' },
  { id: 'insurance', category: 'Insurance Provider', partner: 'Insurance Desk', commercialHandling: 'Finance controlled', trigger: 'Policy issued', terms: 'Policy must match visa and university requirements.' },
  { id: 'gic', category: 'GIC Account', partner: 'Banking Desk', commercialHandling: 'Finance controlled', trigger: 'Account funded', terms: 'Canada GIC proof and student tagging required.' },
  { id: 'forex', category: 'Foreign Exchange Services', partner: 'Forex Desk', commercialHandling: 'Finance controlled', trigger: 'Remittance completed', terms: 'KYC and final remittance receipt required.' },
  { id: 'credential', category: 'Credential Evaluation', partner: 'Evaluation Desk', commercialHandling: 'Finance controlled', trigger: 'Report delivered', terms: 'Applies to paid evaluation orders only.' },
  { id: 'blocked', category: 'Blocked Account', partner: 'Germany Desk', commercialHandling: 'Finance controlled', trigger: 'Blocked account funded', terms: 'Germany student account proof required.' },
  { id: 'bank', category: 'Bank Account', partner: 'Banking Desk', commercialHandling: 'Finance controlled', trigger: 'Account activated', terms: 'Partner credit is reviewed after the bank confirms an active student account.' },
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ruleKey(country, university) {
  return `${normalize(country)}|${normalize(university)}`;
}

let exactRuleMap = new Map();
let ruleIdMap = new Map();

function rebuildRuleIndexes(rows) {
  commissionStructureRows = Array.isArray(rows) ? rows : [];
  commissionYears = ['All', ...new Set(commissionStructureRows.map((row) => row.year).filter(Boolean).sort())];
  commissionIntakes = ['All', ...new Set(commissionStructureRows.map((row) => row.intake).filter(Boolean).sort())];
  exactRuleMap = new Map(commissionStructureRows.map((rule) => [ruleKey(rule.country, rule.university), rule]));
  ruleIdMap = new Map(commissionStructureRows.map((rule) => [rule.id, rule]));
}

export async function loadCommissionRules() {
  if (commissionStructureRows.length) return commissionStructureRows;

  if (!commissionRulesPromise) {
    commissionRulesPromise = fetch(staticUrl('data/partner-university-index.json'))
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => {
        rebuildRuleIndexes(rows);
        return commissionStructureRows;
      })
      .catch(() => {
        rebuildRuleIndexes([]);
        return [];
      });
  }

  return commissionRulesPromise;
}

function levelMatches(rule, course) {
  const ruleLevel = normalize(rule.studyLevel);
  const courseLevel = normalize(course.level);
  if (!ruleLevel || ruleLevel.includes('all study')) return true;
  if (ruleLevel.includes('under') || ruleLevel.includes('ug') || ruleLevel.includes('pathway')) {
    return courseLevel.includes('under') || courseLevel.includes('bachelor') || courseLevel.includes('foundation');
  }
  if (ruleLevel.includes('post') || ruleLevel.includes('master') || ruleLevel.includes('pg')) {
    return courseLevel.includes('post') || courseLevel.includes('master');
  }
  if (ruleLevel.includes('phd') || ruleLevel.includes('doctor')) return courseLevel.includes('phd') || courseLevel.includes('doctor');
  return ruleLevel === courseLevel;
}

const tokenStopWords = new Set([
  'and',
  'at',
  'campus',
  'college',
  'for',
  'in',
  'international',
  'of',
  'school',
  'the',
  'university',
]);

function universityTokens(value) {
  return normalize(value)
    .split(' ')
    .filter((token) => token.length > 2 && !tokenStopWords.has(token));
}

function universityMatches(ruleUniversity, courseUniversity) {
  const ruleName = normalize(ruleUniversity);
  const courseName = normalize(courseUniversity);
  if (!ruleName || !courseName) return false;
  if (ruleName === courseName || ruleName.includes(courseName) || courseName.includes(ruleName)) return true;

  const ruleTokens = universityTokens(ruleUniversity);
  const courseTokens = universityTokens(courseUniversity);
  const smaller = ruleTokens.length <= courseTokens.length ? ruleTokens : courseTokens;
  const larger = ruleTokens.length <= courseTokens.length ? courseTokens : ruleTokens;
  if (!smaller.length) return false;

  const overlap = smaller.filter((token) => larger.includes(token)).length;
  if (smaller.length === 1) return smaller[0].length >= 4 && overlap === 1;
  return overlap / smaller.length >= 0.75;
}

export function getCommissionRuleForCourse(course) {
  if (!course?.university) return null;
  if (course.partner_university_id && ruleIdMap.has(course.partner_university_id)) {
    return ruleIdMap.get(course.partner_university_id);
  }

  const exact = exactRuleMap.get(ruleKey(course.country, course.university));
  if (exact && levelMatches(exact, course)) return exact;

  const courseCountry = normalize(course.country);
  return commissionStructureRows.find((rule) => (
    normalize(rule.country) === courseCountry
    && universityMatches(rule.university, course.university)
    && levelMatches(rule, course)
  )) || null;
}

export function isCommissionEligibleCourse(course) {
  return Boolean(getCommissionRuleForCourse(course));
}

export function commissionSummary(rule) {
  if (!rule) return 'No partner match';
  return `${rule.eligibilityStatus || 'Partner listed'} · ${rule.studyLevel || 'All levels'}`;
}

export function commissionPriorityScore(course) {
  const rule = getCommissionRuleForCourse(course);
  if (!rule) return 0;
  const verifiedBonus = course.is_verified ? 12 : 0;
  const restrictionPenalty = rule.hasRestrictions ? -8 : 0;
  return 80 + verifiedBonus + restrictionPenalty;
}

export function commissionCoverageForCourses(courses) {
  const matchedRules = new Set();
  const eligibleCourses = courses.filter((course) => {
    const rule = getCommissionRuleForCourse(course);
    if (rule) matchedRules.add(rule.id);
    return Boolean(rule);
  });

  return {
    eligibleCourses: eligibleCourses.length,
    matchedUniversities: matchedRules.size,
    totalUniversities: commissionStructureRows.length,
    missingUniversities: commissionStructureRows.filter((rule) => !matchedRules.has(rule.id)),
  };
}
