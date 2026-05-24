import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookmarkPlus,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  FileDown,
  FileText,
  Filter,
  GraduationCap,
  Info,
  Scale,
  Search,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  commissionCoverageForCourses,
  commissionPriorityScore,
  commissionSummary,
  getCommissionRuleForCourse,
  isCommissionEligibleCourse,
  loadCommissionRules,
} from '../data/commissionRules';
import { intakeOptions } from '../data/formOptions';
import { courseFilterHints } from '../data/referenceWorkflow';
import { useAppState } from '../lib/appState';
import { isSupabaseConfigured } from '../lib/supabase';
import { Badge, EmptyState, Modal, Panel, SelectInput, TextInput } from '../components/ui';

const emptyCourse = {
  university: '',
  country: 'United Kingdom',
  city: '',
  campus: '',
  level: 'Postgraduate',
  subject: '',
  course: '',
  credential: '',
  duration: '',
  mode: 'On campus',
  intake: 'September',
  tuition: '',
  application_fee: '',
  deadline: '',
  partner_note: '',
  eligibility: 'Review eligibility',
  english_requirement: '',
  academic_requirement: '',
  scholarship: '',
  source_url: '',
  source_name: 'Admin upload',
  external_course_id: '',
  is_verified: false,
};

const finderIntakes = [
  'All',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Spring',
  'Summer',
  'Fall',
  'Winter',
];

const liveSearchPageSize = 100;

const partnerPdfCountries = [
  'Australia',
  'Austria',
  'Bahrain',
  'Belgium',
  'Canada',
  'China',
  'Croatia',
  'Cyprus',
  'Denmark',
  'Dubai',
  'Finland',
  'France',
  'Georgia',
  'Germany',
  'Greece',
  'Hungary',
  'India',
  'Indonesia',
  'Ireland',
  'Italy',
  'Japan',
  'Kazakhstan',
  'Lithuania',
  'Luxembourg',
  'Malaysia',
  'Malta',
  'Mauritius',
  'Monaco',
  'Netherlands',
  'New Zealand',
  'Poland',
  'Russia',
  'Saudi Arabia',
  'Singapore',
  'South Korea',
  'Spain',
  'Sri Lanka',
  'Sweden',
  'Switzerland',
  'Thailand',
  'Turkey',
  'United Kingdom',
  'United States',
  'Vietnam',
];

const partnerPdfLevels = ['Undergraduate', 'Postgraduate', 'Diploma'];

const finderYears = ['All', '2026', '2027', '2028'];

const budgetOptions = [
  'Any budget',
  'Under 15,000',
  'Under 25,000',
  'Under 40,000',
  'Needs tuition check',
];

const durationOptions = [
  'All durations',
  'Up to 1 year',
  'Up to 2 years',
  '3 years or more',
  'Needs duration check',
];

const commissionOptions = [
  'All partner statuses',
  'Partner university',
];

const officialFeedTargets = [
  {
    country: 'Partner PDF catalogue',
    rows: '64,466 September 2026 UG/PG programmes',
    source: 'Uploaded commissionable partner PDFs',
    status: 'Loaded',
  },
];

const importTemplateColumns = [
  'country',
  'university',
  'course',
  'level',
  'city',
  'campus',
  'subject',
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
  'source_name',
  'external_course_id',
  'source_updated_at',
  'is_verified',
];

const headerAliases = {
  institution: 'university',
  institution_name: 'university',
  university_name: 'university',
  college: 'university',
  provider: 'university',
  program: 'course',
  programme: 'course',
  program_name: 'course',
  programme_name: 'course',
  course_name: 'course',
  study_level: 'level',
  degree_level: 'level',
  qualification_level: 'level',
  study_area: 'subject',
  discipline: 'subject',
  field_of_study: 'subject',
  annual_tuition: 'tuition',
  tuition_fee: 'tuition',
  fees: 'tuition',
  app_fee: 'application_fee',
  application_deadline: 'deadline',
  url: 'source_url',
  course_url: 'source_url',
  official_url: 'source_url',
  source: 'source_name',
  source_id: 'external_course_id',
  external_id: 'external_course_id',
  last_updated: 'source_updated_at',
  verified: 'is_verified',
  partner_note: 'partner_note',
  partner_status: 'partner_note',
  partner_eligibility: 'partner_note',
  commercial_note: 'partner_note',
  commission_hint: 'partner_note',
};

const sampleImportRows = [
  {
    country: 'United Kingdom',
    university: 'University of Example',
    course: 'MSc Data Analytics',
    level: 'Postgraduate',
    city: 'Manchester',
    campus: 'Main campus',
    subject: 'Data Science',
    credential: 'MSc',
    duration: '1 year',
    mode: 'On campus',
    intake: 'September 2026',
    tuition: 'GBP 18,500',
    application_fee: 'No application fee',
    deadline: 'Rolling',
    partner_note: 'Partner listed; commercial values hidden',
    eligibility: 'Bachelor degree with 55%+',
    english_requirement: 'IELTS 6.5 or equivalent',
    academic_requirement: 'Relevant undergraduate degree',
    scholarship: 'Merit scholarship available',
    source_url: 'https://example.edu/courses/msc-data-analytics',
    source_name: 'Partner programme export',
    external_course_id: 'EXAMPLE-MSC-DA',
    source_updated_at: '2026-05-22',
    is_verified: 'yes',
  },
];

const studentStates = [
  'All states',
  'Delhi',
  'Maharashtra',
  'Rajasthan',
  'Punjab',
  'Gujarat',
  'Karnataka',
  'Tamil Nadu',
  'Telangana',
  'West Bengal',
];

const quickFilterDefinitions = [
  {
    id: 'commission_eligible',
    label: 'Partner University',
    description: 'Universities present in the partner eligibility index.',
    test: (course) => isCommissionEligibleCourse(course),
  },
  {
    id: 'faster_offer',
    label: 'Faster Offer TAT',
    description: 'Programs likely to move quickly after document approval.',
    test: (course) => /rolling|institution/i.test(course.deadline || '') || ['United Kingdom', 'Ireland', 'Dubai'].includes(course.country),
  },
  {
    id: 'scholarship',
    label: 'Scholarship discussion needed',
    description: 'Rows with scholarship notes that need counselor or admin confirmation.',
    test: (course) => Boolean(course.scholarship) && !/none|not available/i.test(course.scholarship),
  },
  {
    id: 'high_acceptance',
    label: 'High-acceptance heuristic',
    description: 'Subject-based shortlist signal; verify against current admissions outcomes.',
    test: (course) => ['Business', 'Management', 'Data', 'Technology', 'Health'].some((item) => String(course.subject || '').includes(item)),
  },
  {
    id: 'english_waiver',
    label: 'Possible English waiver — verify',
    description: 'MOI or internal English review may be possible, subject to institution checks.',
    test: (course) => ['United Kingdom', 'Ireland', 'Dubai', 'Germany'].includes(course.country),
  },
  {
    id: 'affordable',
    label: 'Affordable University',
    description: 'Lower relative tuition or public-fee destination.',
    test: (course) => course.country === 'Germany' || /EUR 0|AED 45|NZD 35|EUR 16/i.test(course.tuition || ''),
  },
  {
    id: 'internship',
    label: 'Co-op & Internships',
    description: 'Programs where work-integrated learning is a counseling angle.',
    test: (course) => /engineering|technology|business|hospitality|management/i.test(`${course.course} ${course.subject}`),
  },
  {
    id: 'job_demand',
    label: 'Career-relevant subject',
    description: 'Computing, data, health, and engineering subjects for career-led counseling.',
    test: (course) => /computer|data|artificial|engineering|health|analytics|cyber/i.test(`${course.course} ${course.subject}`),
  },
  {
    id: 'no_deposit_us',
    label: 'US — verify deposit policy',
    description: 'US rows where deposit policy must be confirmed before advising.',
    test: (course) => course.country === 'United States',
  },
  {
    id: 'major_city',
    label: 'Tier-1 city campus',
    description: 'Large-city campuses for preference matching; confirm campus allocation.',
    test: (course) => ['London', 'Manchester', 'Sydney', 'Melbourne', 'Dublin', 'Dubai', 'Berlin', 'Munich'].includes(course.city),
  },
  {
    id: 'non_collateral',
    label: 'Eligible Non Collateral Loan',
    description: 'Strong shortlist for finance-service handoff.',
    test: (course) => ['United Kingdom', 'Australia', 'New Zealand', 'Ireland', 'Germany'].includes(course.country),
  },
  {
    id: 'gs_aus',
    label: 'GS Approval Check (Aus)',
    description: 'Australia programs that need Genuine Student pre-checks.',
    test: (course) => course.country === 'Australia',
  },
  {
    id: 'low_deposit',
    label: 'Likely lower deposit — verify',
    description: 'Destination-based deposit planning signal; confirm current payment policy.',
    test: (course) => ['United Kingdom', 'Germany', 'Ireland', 'Dubai'].includes(course.country),
  },
  {
    id: 'no_interview',
    label: 'Interview unlikely — verify',
    description: 'Interview appears less likely from destination rules; verify before submission.',
    test: (course) => !['Australia', 'United States'].includes(course.country),
  },
  {
    id: 'mba',
    label: 'MBA Programs',
    description: 'Business, management, and MBA options.',
    test: (course) => /mba|business|management/i.test(`${course.course} ${course.subject}`),
  },
  {
    id: 'research_group_uk',
    label: 'Research Group UK',
    description: 'Research-heavy UK universities to prioritize for profile fit.',
    test: (course) => course.country === 'United Kingdom' && /Manchester|Birmingham|Glasgow|Leeds|Nottingham/i.test(course.university),
  },
  {
    id: 'moi',
    label: 'MOI possible — verify',
    description: 'MOI discussion needed before English test requirement is finalized.',
    test: (course) => ['United Kingdom', 'Ireland', 'Dubai', 'Germany'].includes(course.country),
  },
];

function normalizedLevel(value) {
  if (/master|post/i.test(value || '')) return 'Postgraduate';
  if (/under|bachelor|school/i.test(value || '')) return 'Undergraduate';
  return value || '';
}

function matchesIntake(course, intake) {
  if (intake === 'All') return true;
  const haystack = String(course.intake || '').toLowerCase();
  const needle = intake.toLowerCase();
  const shortNeedle = needle.slice(0, 3);
  return haystack.includes(needle) || haystack.includes(shortNeedle);
}

function courseBadges(course) {
  const badges = quickFilterDefinitions
    .filter((item) => item.test(course))
    .slice(0, 3)
    .map((item) => item.label);
  const commissionRule = getCommissionRuleForCourse(course);
  return commissionRule ? ['Partner listed', ...badges].slice(0, 4) : badges;
}

function locationLabel(course) {
  const place = course.city || course.campus;
  return [place, course.country].filter(Boolean).join(', ') || 'Location to confirm';
}

function normalizeHeader(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return headerAliases[normalized] || normalized;
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

  if (field || row.length) row.push(field.trim());
  if (row.length) rows.push(row);
  return rows.filter((item) => item.some(Boolean));
}

function normalizeImportLevel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['ug', 'undergrad', 'undergraduate', 'bachelor', 'bachelors', 'first cycle'].includes(normalized)) return 'Undergraduate';
  if (['pg', 'postgrad', 'postgraduate', 'master', 'masters', 'second cycle'].includes(normalized)) return 'Postgraduate';
  return value || '';
}

function parseImportBoolean(value) {
  return ['1', 'true', 'yes', 'y', 'verified'].includes(String(value || '').trim().toLowerCase());
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function rowsToCsv(rows, columns) {
  const header = columns.map(csvCell).join(',');
  const body = rows.map((row) => columns.map((column) => csvCell(row[column])).join(','));
  return [header, ...body].join('\n');
}

function downloadCsv(filename, rows, columns) {
  const blob = new Blob([rowsToCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function parseCourseCsv(text) {
  const [headerRow, ...dataRows] = parseCsv(text);
  if (!headerRow?.length) return { courses: [], errors: ['CSV file is empty.'] };

  const headers = headerRow.map(normalizeHeader);
  const required = ['country', 'university', 'course', 'level'];
  const missingHeaders = required.filter((field) => !headers.includes(field));
  if (missingHeaders.length) {
    return { courses: [], errors: [`Missing required columns: ${missingHeaders.join(', ')}`] };
  }

  const courses = [];
  const errors = [];

  dataRows.forEach((row, rowIndex) => {
    const raw = {};
    headers.forEach((header, index) => {
      raw[header] = row[index] || '';
    });

    const missingFields = required.filter((field) => !raw[field]);
    if (missingFields.length) {
      errors.push(`Row ${rowIndex + 2}: missing ${missingFields.join(', ')}`);
      return;
    }

    courses.push({
      ...raw,
      level: normalizeImportLevel(raw.level),
      campus: raw.campus || raw.city,
      mode: raw.mode || 'On campus',
      eligibility: raw.eligibility || 'Review eligibility',
      source_updated_at: raw.source_updated_at || new Date().toISOString().slice(0, 10),
      is_verified: parseImportBoolean(raw.is_verified),
    });
  });

  return { courses, errors };
}

function tuitionAmount(course) {
  const text = String(course.tuition || '').replace(/,/g, '');
  const match = text.match(/(\d{4,6})/);
  return match ? Number(match[1]) : null;
}

function matchesBudget(course, budget) {
  if (budget === 'Any budget') return true;
  const amount = tuitionAmount(course);
  if (budget === 'Needs tuition check') return amount === null;
  if (amount === null) return false;
  if (budget === 'Under 15,000') return amount <= 15000;
  if (budget === 'Under 25,000') return amount <= 25000;
  if (budget === 'Under 40,000') return amount <= 40000;
  return true;
}

function durationMonths(course) {
  const text = String(course.duration || '').toLowerCase();
  if (!text || /check|varies|institution/.test(text)) return null;
  const yearMatch = text.match(/(\d+(?:\.\d+)?)\s*(year|yr)/);
  if (yearMatch) return Number(yearMatch[1]) * 12;
  const monthMatch = text.match(/(\d+)\s*(month|mo)/);
  return monthMatch ? Number(monthMatch[1]) : null;
}

function matchesDuration(course, duration) {
  if (duration === 'All durations') return true;
  const months = durationMonths(course);
  if (duration === 'Needs duration check') return months === null;
  if (months === null) return false;
  if (duration === 'Up to 1 year') return months <= 12;
  if (duration === 'Up to 2 years') return months <= 24;
  if (duration === '3 years or more') return months >= 36;
  return true;
}

function isPdfPartnerCourse(course) {
  return Boolean(course.partner_university_id)
    || /partner september 2026 catalogue/i.test(course.source_name || '')
    || /partner university/i.test(course.partner_note || course.commission_hint || '');
}

function optionList(staticOptions, loadedOptions) {
  return ['All', ...new Set([...staticOptions, ...loadedOptions].filter(Boolean))].sort((a, b) => {
    if (a === 'All') return -1;
    if (b === 'All') return 1;
    return a.localeCompare(b);
  });
}

function matchesCommission(course, commissionFilter) {
  const rule = getCommissionRuleForCourse(course);
  if (commissionFilter === 'All partner statuses') return true;
  if (commissionFilter === 'Partner university') return Boolean(rule);
  return true;
}

function calculateCatalogStats(courses) {
  const total = courses.length;
  const verified = courses.filter((course) => course.is_verified === true).length;
  const missingUrl = courses.filter((course) => !course.source_url).length;
  const missingTuition = courses.filter((course) => tuitionAmount(course) === null).length;
  const missingDeadline = courses.filter((course) => !course.deadline || /check/i.test(course.deadline)).length;
  const countries = new Set(courses.map((course) => course.country).filter(Boolean)).size;
  const universities = new Set(courses.map((course) => `${course.country}|${course.university}`).filter(Boolean)).size;
  const readiness = total ? 100 : 0;

  return {
    total,
    verified,
    missingUrl,
    missingTuition,
    missingDeadline,
    countries,
    universities,
    readiness,
  };
}

function downloadCourses(filename, rows, student) {
  const header = ['Course', 'University', 'Country', 'City', 'Level', 'Intake', 'Duration', 'Tuition', 'Deadline', 'Student'];
  const body = rows.map((course) => [
    course.course,
    course.university,
    course.country,
    course.city,
    course.level,
    course.intake,
    course.duration,
    course.tuition,
    course.deadline,
    student ? `${student.first_name} ${student.last_name}` : '',
  ].map(csvCell).join(','));
  const blob = new Blob([[header.map(csvCell).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function fitForStudent(course, student) {
  if (!student) return 70;
  let score = 42;
  if (student.desired_countries?.includes(course.country)) score += 24;
  if (normalizedLevel(student.study_level) === normalizedLevel(course.level)) score += 18;
  const subjectKeyword = String(student.discipline || '').toLowerCase().split(' ')[0];
  if (subjectKeyword && `${course.subject} ${course.course}`.toLowerCase().includes(subjectKeyword)) score += 10;
  score += Math.min(6, Math.round(Number(student.profile_score || 0) / 20));
  return Math.min(100, score);
}

function fitTone(score) {
  if (score >= 82) return 'success';
  if (score >= 64) return 'info';
  if (score >= 50) return 'warning';
  return 'neutral';
}

export function CourseFinder({ onNavigate }) {
  const {
    addApplication,
    addCourse,
    bulkImportCourses,
    courseCatalogStatus,
    courses,
    currentUser,
    loadCourseCatalogCount,
    searchCourses,
    visibleStudents,
  } = useAppState();
  const showAdminCatalogTools = false;
  const [country, setCountry] = useState('All');
  const [level, setLevel] = useState('All');
  const [query, setQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [intakeFilter, setIntakeFilter] = useState('September');
  const [yearFilter, setYearFilter] = useState('2026');
  const [budgetFilter, setBudgetFilter] = useState('Any budget');
  const [durationFilter, setDurationFilter] = useState('All durations');
  const [commissionFilter, setCommissionFilter] = useState('All partner statuses');
  const [studentState, setStudentState] = useState('All states');
  const [quickFilter, setQuickFilter] = useState('All');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [sortMode, setSortMode] = useState('Best fit');
  const [selectedStudentId, setSelectedStudentId] = useState(visibleStudents[0]?.id || '');
  const [detailCourse, setDetailCourse] = useState(null);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [submitting, setSubmitting] = useState(false);
  const [paging, setPaging] = useState({ key: '', limit: 60 });
  const [compareIds, setCompareIds] = useState(new Set());
  const [importFileName, setImportFileName] = useState('');
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [ruleCount, setRuleCount] = useState(0);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [liveSearchOffset, setLiveSearchOffset] = useState(0);
  const [liveSearchHasMore, setLiveSearchHasMore] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [applySuccess, setApplySuccess] = useState('');
  const searchDebounceRef = useRef(null);
  const searchCoursesRef = useRef(searchCourses);

  useEffect(() => {
    searchCoursesRef.current = searchCourses;
  }, [searchCourses]);

  useEffect(() => {
    let active = true;
    loadCommissionRules().then((rows) => {
      if (active) setRuleCount(rows.length);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    loadCourseCatalogCount?.().catch(() => {});
  }, [loadCourseCatalogCount]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setQuery(searchDraft.trim());
      setPaging({ key: '', limit: 60 });
    }, 250);
    searchDebounceRef.current = timeoutId;
    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchDraft]);

  useEffect(() => {
    if (!isSupabaseConfigured || !searchCoursesRef.current) return undefined;

    let active = true;

    Promise.resolve().then(() => {
      if (!active) return [];
      setCatalogSearching(true);
      setApplyError('');
      const runLiveSearch = searchCoursesRef.current;
      if (!runLiveSearch) return [];
      return runLiveSearch({
        country,
        level,
        intake: intakeFilter,
        query,
        limit: liveSearchPageSize,
        offset: 0,
      });
    }).then((rows) => {
      if (!active) return;
      setLiveSearchOffset(rows?.length || 0);
      setLiveSearchHasMore((rows?.length || 0) === liveSearchPageSize);
      setPaging({ key: '', limit: 60 });
    }).catch((error) => {
      if (!active) return;
      setApplyError(error?.message || 'Could not search the live course catalogue.');
    }).finally(() => {
      if (active) setCatalogSearching(false);
    });

    return () => {
      active = false;
    };
  }, [country, intakeFilter, level, query]);

  const selectedStudent = visibleStudents.find((student) => student.id === selectedStudentId) || visibleStudents[0];
  const partnerCourses = useMemo(() => courses.filter(isPdfPartnerCourse), [courses]);
  const countries = useMemo(() => optionList(partnerPdfCountries, partnerCourses.map((course) => course.country)), [partnerCourses]);
  const levels = useMemo(() => optionList(partnerPdfLevels, partnerCourses.map((course) => course.level)), [partnerCourses]);
  const adminCountries = countries.filter((item) => item !== 'All');
  const subjects = useMemo(() => [...new Set(partnerCourses.map((course) => course.subject).filter(Boolean))].sort().slice(0, 120), [partnerCourses]);
  const catalogStats = useMemo(() => calculateCatalogStats(partnerCourses), [partnerCourses]);
  const commissionCoverage = useMemo(() => {
    if (!ruleCount) return commissionCoverageForCourses(partnerCourses);
    return commissionCoverageForCourses(partnerCourses);
  }, [partnerCourses, ruleCount]);

  const baseFiltered = useMemo(() => partnerCourses.filter((course) => {
    if (country !== 'All' && course.country !== country) return false;
    if (level !== 'All' && course.level !== level) return false;
    if (subject && !`${course.subject} ${course.course}`.toLowerCase().includes(subject.toLowerCase())) return false;
    if (!matchesIntake(course, intakeFilter)) return false;
    if (yearFilter !== 'All' && !String(course.intake || '').includes(yearFilter)) return false;
    if (!matchesBudget(course, budgetFilter)) return false;
    if (!matchesDuration(course, durationFilter)) return false;
    if (!matchesCommission(course, commissionFilter)) return false;
    if (eligibleOnly && fitForStudent(course, selectedStudent) < 64) return false;
    const haystack = `${course.university} ${course.course} ${course.subject} ${course.city} ${course.country} ${course.credential} ${course.search_keywords || ''}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [budgetFilter, commissionFilter, country, durationFilter, eligibleOnly, intakeFilter, level, partnerCourses, query, selectedStudent, subject, yearFilter]);

  const quickFilterCounts = useMemo(() => {
    const definitions = quickFilterDefinitions;
    return Object.fromEntries(
      definitions.map((item) => [item.id, baseFiltered.filter((course) => item.test(course)).length])
    );
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    const active = quickFilterDefinitions.find((item) => item.id === quickFilter);
    return active ? baseFiltered.filter((course) => active.test(course)) : baseFiltered;
  }, [baseFiltered, quickFilter]);

  const sortedFiltered = useMemo(() => [...filtered].sort((a, b) => {
    if (sortMode === 'Best fit') return fitForStudent(b, selectedStudent) - fitForStudent(a, selectedStudent);
    if (sortMode === 'Partner priority' && ruleCount >= 0) return commissionPriorityScore(b) - commissionPriorityScore(a);
    if (sortMode === 'University') return String(a.university).localeCompare(String(b.university));
    if (sortMode === 'Deadline') return String(a.deadline || 'zzzz').localeCompare(String(b.deadline || 'zzzz'));
    if (sortMode === 'PDF listed first') return Number(isPdfPartnerCourse(b)) - Number(isPdfPartnerCourse(a));
    return 0;
  }), [filtered, ruleCount, selectedStudent, sortMode]);

  const filterKey = `${country}|${level}|${query}|${subject}|${intakeFilter}|${yearFilter}|${budgetFilter}|${durationFilter}|${commissionFilter}|${quickFilter}|${eligibleOnly}|${sortMode}|${selectedStudent?.id || ''}`;
  const visibleLimit = paging.key === filterKey ? paging.limit : 60;
  const visibleCourses = sortedFiltered.slice(0, visibleLimit);
  const compareCourses = partnerCourses.filter((course) => compareIds.has(course.id));
  const detailCommissionRule = detailCourse ? getCommissionRuleForCourse(detailCourse) : null;
  const courseCatalogueMissing = isSupabaseConfigured && partnerCourses.length === 0 && !courseCatalogStatus?.isLoadingFull;
  const loadingFullCatalog = Boolean(courseCatalogStatus?.isLoadingFull);
  const totalCatalogCount = Math.max(courseCatalogStatus?.totalAvailable || 0, partnerCourses.length);
  const availableCountryCount = Math.max(catalogStats.countries, countries.length - 1);

  function toggleCompare(courseId) {
    setCompareIds((current) => {
      const next = new Set(current);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else if (next.size < 24) {
        next.add(courseId);
      }
      return next;
    });
  }

  async function handleAddCourse(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await addCourse(courseForm);
      setCourseForm(emptyCourse);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCourseImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = parseCourseCsv(text);
    setImportFileName(file.name);
    setImportRows(parsed.courses);
    setImportErrors(parsed.errors);
    setImportResult(null);
    event.target.value = '';
  }

  async function handleBulkImport() {
    if (!importRows.length) return;
    setSubmitting(true);
    try {
      const result = await bulkImportCourses(importRows, { updateExisting: true });
      setImportResult(result);
      setImportErrors(result.errors || []);
      setImportRows([]);
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownloadTemplate() {
    downloadCsv('bizzlo-course-import-template.csv', sampleImportRows, importTemplateColumns);
  }

  function handleExportCatalog() {
    downloadCsv('bizzlo-current-course-catalog.csv', courses, importTemplateColumns);
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const nextQuery = searchDraft.trim();
    clearTimeout(searchDebounceRef.current);
    setQuery(nextQuery);
    setPaging({ key: '', limit: 60 });
    setApplyError('');
  }

  function handleClearSearch() {
    clearTimeout(searchDebounceRef.current);
    setSearchDraft('');
    setQuery('');
    setPaging({ key: '', limit: 60 });
    setLiveSearchOffset(0);
    setLiveSearchHasMore(false);
    setApplyError('');
  }

  async function handleLoadMoreLiveResults() {
    if (!isSupabaseConfigured || catalogSearching) return;
    setCatalogSearching(true);
    setApplyError('');
    try {
      const rows = await searchCourses?.({
        country,
        level,
        intake: intakeFilter,
        query,
        limit: liveSearchPageSize,
        offset: liveSearchOffset,
        append: true,
      });
      const loadedRows = rows?.length || 0;
      setLiveSearchOffset((current) => current + loadedRows);
      setLiveSearchHasMore(loadedRows === liveSearchPageSize);
      setPaging({ key: filterKey, limit: visibleLimit + liveSearchPageSize });
    } catch (error) {
      setApplyError(error?.message || 'Could not load more live course results.');
    } finally {
      setCatalogSearching(false);
    }
  }

  async function handleApply(course) {
    setApplyError('');
    setApplySuccess('');
    if (!selectedStudent) {
      setApplyError('Choose a student profile before applying to a course.');
      return;
    }

    try {
      await addApplication({
        student_id: selectedStudent.id,
        course_id: course.id,
        university: course.university,
        country: course.country,
        course: course.course,
        intake: course.intake,
      });
      setApplySuccess(`Application created for ${selectedStudent.first_name} ${selectedStudent.last_name}.`);
      onNavigate('applications');
    } catch (error) {
      setApplyError(error?.message || 'Could not create this application.');
    }
  }

  async function handleMultiApply() {
    setApplyError('');
    setApplySuccess('');
    if (!selectedStudent) {
      setApplyError('Choose a student profile before applying to selected courses.');
      return;
    }
    if (!compareCourses.length) {
      setApplyError('Select at least one course before using Apply to selected.');
      return;
    }
    setSubmitting(true);
    try {
      for (const course of compareCourses.slice(0, 8)) {
        await addApplication({
          student_id: selectedStudent.id,
          course_id: course.id,
          university: course.university,
          country: course.country,
          course: course.course,
          intake: course.intake,
        });
      }
      setCompareIds(new Set());
      setApplySuccess(`Created ${Math.min(compareCourses.length, 8)} application${compareCourses.length === 1 ? '' : 's'} for ${selectedStudent.first_name} ${selectedStudent.last_name}.`);
      onNavigate('applications');
    } catch (error) {
      setApplyError(error?.message || 'Could not create selected applications.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Program Search</h1>
          <p>Search only commissionable partner programmes from the uploaded partner PDFs, shortlist options, and create applications from the same screen.</p>
        </div>
      </div>

      <div className="finder-hero">
        <div>
          <strong>{totalCatalogCount.toLocaleString()}</strong>
          <span>programmes in full catalogue</span>
        </div>
        <div>
          <strong>{partnerCourses.length.toLocaleString()}</strong>
          <span>{loadingFullCatalog ? 'loading live matches' : 'live matches loaded'}</span>
        </div>
        <div>
          <strong>{filtered.length.toLocaleString()}</strong>
          <span>matching programmes</span>
        </div>
        <div>
          <strong>{availableCountryCount}</strong>
          <span>countries available</span>
        </div>
        <div>
          <strong>{commissionCoverage.eligibleCourses.toLocaleString()}</strong>
          <span>commissionable programmes</span>
        </div>
        <div>
          <strong>{catalogStats.readiness}%</strong>
          <span>PDF catalogue scope</span>
        </div>
      </div>

      {loadingFullCatalog ? (
        <div className="system-banner info">
          Loading live course matches: {(courseCatalogStatus?.totalLoaded || partnerCourses.length).toLocaleString()}
          {courseCatalogStatus?.totalAvailable ? ` of ${courseCatalogStatus.totalAvailable.toLocaleString()}` : ''} programmes indexed.
        </div>
      ) : null}

      {applyError ? <div className="system-banner error">{applyError}</div> : null}
      {applySuccess ? <div className="system-banner success">{applySuccess}</div> : null}

      <Panel className="finder-panel">
        <div className="finder-controls">
          <form className="finder-search-row" onSubmit={handleSearchSubmit}>
            <div className="search-box">
              <Filter size={17} />
              <input placeholder="Search course, university, city, subject..." value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} />
            </div>
            <button className="primary-button" type="submit" disabled={catalogSearching}>
              <Search size={15} />
              {catalogSearching ? 'Searching...' : 'Search'}
            </button>
            <button className="secondary-button" type="button" onClick={handleClearSearch}>
              Clear
            </button>
          </form>
          <SelectInput label="Country" value={country} onChange={(event) => setCountry(event.target.value)}>
            {countries.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Level" value={level} onChange={(event) => setLevel(event.target.value)}>
            {levels.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Intake" value={intakeFilter} onChange={(event) => setIntakeFilter(event.target.value)}>
            {finderIntakes.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Year" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            {finderYears.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Budget" value={budgetFilter} onChange={(event) => setBudgetFilter(event.target.value)}>
            {budgetOptions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Duration" value={durationFilter} onChange={(event) => setDurationFilter(event.target.value)}>
            {durationOptions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Partner status" value={commissionFilter} onChange={(event) => setCommissionFilter(event.target.value)}>
            {commissionOptions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Sort" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option>Best fit</option>
            <option>Partner priority</option>
            <option>PDF listed first</option>
            <option>Deadline</option>
            <option>University</option>
          </SelectInput>
          <SelectInput label="Student state" value={studentState} onChange={(event) => setStudentState(event.target.value)}>
            {studentStates.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Student profile" value={selectedStudent?.id || ''} onChange={(event) => setSelectedStudentId(event.target.value)}>
            {visibleStudents.length ? (
              visibleStudents.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)
            ) : (
              <option value="">Create a student first</option>
            )}
          </SelectInput>
        </div>
        <div className="country-tabs">
          {countries.slice(0, 10).map((item) => (
            <button className={country === item ? 'active' : ''} key={item} type="button" onClick={() => setCountry(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="filter-chips">
          <label>
            <input type="checkbox" checked={eligibleOnly} onChange={(event) => setEligibleOnly(event.target.checked)} />
            Fit score 64%+
          </label>
          {courseFilterHints.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="quick-filter-strip" aria-label="Quick filters">
          <button className={quickFilter === 'All' ? 'active' : ''} type="button" onClick={() => setQuickFilter('All')}>
            <Sparkles size={16} />
            <span>
              <strong>All Quick Filters</strong>
              <small>{baseFiltered.length.toLocaleString()} programs</small>
            </span>
          </button>
          {quickFilterDefinitions.map((item) => (
            <button className={quickFilter === item.id ? 'active' : ''} key={item.id} type="button" onClick={() => setQuickFilter(item.id)}>
              <Sparkles size={16} />
              <span>
                <strong>{item.label}</strong>
                <small>{(quickFilterCounts[item.id] || 0).toLocaleString()} programs</small>
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <div className="result-bar">
        <span>{sortedFiltered.length.toLocaleString()} programmes found</span>
        <span>
          {`${compareCourses.length}/24 selected for comparison`}
        </span>
        {liveSearchOffset ? <span>{liveSearchOffset.toLocaleString()} live matches loaded</span> : null}
        <div className="result-actions">
          <button className="secondary-button" type="button" onClick={() => downloadCourses('bizzlo-top-25-programs.csv', sortedFiltered.slice(0, 25), selectedStudent)}>
            <Download size={15} />
            Download Top 25
          </button>
          <button className="secondary-button" type="button" disabled={!compareCourses.length} onClick={() => downloadCourses('bizzlo-selected-programs.csv', compareCourses, selectedStudent)}>
            <FileText size={15} />
            Download Selected
          </button>
        </div>
      </div>

      {visibleCourses.length ? (
        <div className="program-card-grid">
          {visibleCourses.slice(0, 6).map((course) => {
            const fit = fitForStudent(course, selectedStudent);
            const commissionRule = getCommissionRuleForCourse(course);
            return (
              <article className="program-card" key={`card-${course.id}`}>
                <div className="program-card-head">
                  <GraduationCap size={19} />
                  <div className="program-card-badge-stack">
                    {commissionRule ? <Badge tone="success">Partner</Badge> : null}
                    <Badge tone={fitTone(fit)}>{fit}% fit</Badge>
                  </div>
                </div>
                <strong>{course.course}</strong>
                <span>{course.university} · {locationLabel(course)}</span>
                <div className="program-badges">
                  {courseBadges(course).map((badge) => <Badge key={badge} tone="info">{badge}</Badge>)}
                </div>
                <dl>
                  <div><dt>Level</dt><dd>{course.level}</dd></div>
                  <div><dt>Intake</dt><dd>{course.intake}</dd></div>
                  <div><dt>Tuition</dt><dd>{course.tuition || 'Check'}</dd></div>
                  <div><dt>Deadline</dt><dd>{course.deadline || 'Rolling'}</dd></div>
                  <div><dt>Partner status</dt><dd>{commissionRule ? commissionSummary(commissionRule) : 'Not mapped'}</dd></div>
                </dl>
                <div className="program-actions">
                  <button className={compareIds.has(course.id) ? 'secondary-button active' : 'secondary-button'} type="button" onClick={() => toggleCompare(course.id)}>
                    {compareIds.has(course.id) ? <CheckCircle2 size={15} /> : <Scale size={15} />}
                    Compare
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setDetailCourse(course)}>
                    <Info size={15} />
                    Details
                  </button>
                  <button className="primary-button" type="button" onClick={() => handleApply(course)}>
                    <BookmarkPlus size={15} />
                    Apply
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Panel>
          {courseCatalogueMissing ? (
            <>
              <EmptyState
                icon={Database}
                title="Course catalogue not seeded yet"
                text="Run `npm run seed:supabase-courses` or upload via Admin import."
              />
              <div className="empty-state-actions">
                <button className="primary-button" type="button" onClick={() => setShowImportModal(true)}>
                  <UploadCloud size={15} />
                  Open Admin import
                </button>
              </div>
            </>
          ) : (
            <EmptyState icon={SearchX} title="No programmes match these filters" text="Clear the search, turn off verified-only, or choose another country/level." />
          )}
        </Panel>
      )}

      {visibleCourses.length ? (
      <Panel className="program-table-panel">
        <div className="program-table">
          <table>
            <thead>
              <tr>
                <th>Compare</th>
                <th>Programme</th>
                <th>Institution</th>
                <th>Fit</th>
                <th>Level</th>
                <th>Duration</th>
                <th>Intake</th>
                <th>Tuition</th>
                <th>Deadline</th>
                <th>Partner</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleCourses.map((course) => {
                const fit = fitForStudent(course, selectedStudent);
                const commissionRule = getCommissionRuleForCourse(course);
                return (
                  <tr key={course.id}>
                    <td>
                      <button className={compareIds.has(course.id) ? 'compare-toggle active' : 'compare-toggle'} type="button" onClick={() => toggleCompare(course.id)}>
                        {compareIds.has(course.id) ? <CheckCircle2 size={16} /> : <Scale size={16} />}
                      </button>
                    </td>
                    <td>
                      <strong>{course.course}</strong>
                      <small>{course.subject || course.credential} · {course.mode || 'On campus'}</small>
                    </td>
                    <td>{course.university}<small>{locationLabel(course)}</small></td>
                    <td><Badge tone={fitTone(fit)}>{fit}% fit</Badge></td>
                    <td>{course.level}</td>
                    <td>{course.duration || 'Check'}</td>
                    <td>{course.intake}</td>
                    <td>{course.tuition || 'Check'}</td>
                    <td>{course.deadline || 'Rolling'}</td>
                    <td>
                      {commissionRule ? (
                        <>
                          <Badge tone="success">Listed</Badge>
                          <small>{commissionRule.studyLevel || 'All levels'} · PDF listed</small>
                        </>
                      ) : <small>No match</small>}
                    </td>
                    <td>
                      <button className="row-icon-button" type="button" onClick={() => setDetailCourse(course)}>
                        <Info size={15} />
                        Details
                      </button>
                      <button className="row-icon-button" type="button" onClick={() => handleApply(course)}>
                        <BookmarkPlus size={15} />
                        Apply
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      ) : null}

      {visibleLimit < sortedFiltered.length ? (
        <div className="list-footer">
          <button className="secondary-button" type="button" onClick={() => setPaging({ key: filterKey, limit: visibleLimit + 60 })}>
            Show more programmes
          </button>
        </div>
      ) : null}

      {liveSearchHasMore ? (
        <div className="list-footer">
          <button className="secondary-button" type="button" disabled={catalogSearching} onClick={handleLoadMoreLiveResults}>
            {catalogSearching ? 'Loading...' : 'Load more live results'}
          </button>
        </div>
      ) : null}

      {compareCourses.length ? (
        <Panel
          title={`Compare ${compareCourses.length} Programmes`}
          description="Keep the shortlist tight, then create applications for the selected student."
          action={(
            <button className="primary-button" type="button" disabled={submitting} onClick={() => handleMultiApply()}>
              {submitting ? 'Creating...' : 'Apply to selected'}
            </button>
          )}
        >
          <div className="compare-grid">
            {compareCourses.map((course) => {
              const fit = fitForStudent(course, selectedStudent);
              const commissionRule = getCommissionRuleForCourse(course);
              return (
                <article key={course.id}>
                  <button type="button" onClick={() => toggleCompare(course.id)} aria-label="Remove from comparison">
                    <X size={15} />
                  </button>
                  <GraduationCap size={19} />
                  <strong>{course.course}</strong>
                  <span>{course.university}</span>
                  <dl>
                    <div><dt>Fit</dt><dd>{fit}%</dd></div>
                    <div><dt>Country</dt><dd>{course.country}</dd></div>
                    <div><dt>Tuition</dt><dd>{course.tuition}</dd></div>
                    <div><dt>Partner</dt><dd>{commissionRule ? 'Listed' : 'Not mapped'}</dd></div>
                    <div><dt>Listing</dt><dd>PDF listed</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <Modal
        open={Boolean(detailCourse)}
        onClose={() => setDetailCourse(null)}
        title={detailCourse?.course || 'Program Details'}
        description={detailCourse ? `${detailCourse.university} · ${locationLabel(detailCourse)}` : ''}
      >
        {detailCourse ? (
          <div className="course-detail-modal">
            <div className="course-detail-hero">
              <div className="university-logo-mark">{detailCourse.university.slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{detailCourse.university}</strong>
                <span>{detailCourse.campus || detailCourse.city || 'Campus to confirm'} · {detailCourse.country}</span>
                <small>Partner listing updated: {detailCourse.source_updated_at || 'Needs verification'}</small>
              </div>
              <Badge tone="success">PDF listed</Badge>
            </div>
            <div className="program-badges">
              {courseBadges(detailCourse).map((badge) => <Badge key={badge} tone="info">{badge}</Badge>)}
            </div>
            <dl className="detail-dl detail-grid">
              <div><dt>Intakes</dt><dd>{detailCourse.intake}</dd></div>
              <div><dt>Duration</dt><dd>{detailCourse.duration || 'Check'}</dd></div>
              <div><dt>Campus</dt><dd>{detailCourse.campus || detailCourse.city}</dd></div>
              <div><dt>Application deadline</dt><dd>{detailCourse.deadline || 'Rolling'}</dd></div>
              <div><dt>Application fee</dt><dd>{detailCourse.application_fee || 'Check university'}</dd></div>
              <div><dt>Yearly tuition fee</dt><dd>{detailCourse.tuition || 'Check university'}</dd></div>
              <div><dt>Partner status</dt><dd>{detailCommissionRule ? commissionSummary(detailCommissionRule) : 'Not mapped'}</dd></div>
              <div><dt>Eligibility proof</dt><dd>{detailCommissionRule ? 'Partner commission PDF' : 'Check admin index'}</dd></div>
              <div><dt>English requirement</dt><dd>{detailCourse.english_requirement || 'IELTS/PTE/TOEFL review required'}</dd></div>
              <div><dt>Academic requirement</dt><dd>{detailCourse.academic_requirement || detailCourse.eligibility}</dd></div>
            </dl>
            {detailCommissionRule ? (
              <section className="course-detail-note commission-detail-note">
                <strong>Partner eligibility notes</strong>
                <span>This university is present in the partner eligibility index. Commercial terms stay finance-controlled and are not shown in Program Search.</span>
                {detailCommissionRule.hasRestrictions ? <small>Restrictions may apply. Admin should verify course-level eligibility before submission.</small> : null}
                {detailCommissionRule.updatedAt ? <small>Last updated: {detailCommissionRule.updatedAt}</small> : null}
              </section>
            ) : null}
            <section className="course-detail-note">
              <strong>Standardized test requirements</strong>
              <span>No test requirement captured in Bizzlo yet. Admin should verify GRE/GMAT/SAT flags before final submission.</span>
            </section>
            <section className="course-detail-note">
              <strong>Programme link</strong>
              <span>{detailCourse.source_url || 'Programme link to be added by admin.'}</span>
            </section>
            <footer className="form-footer detail-footer">
              <button className="secondary-button" type="button" onClick={() => downloadCourses('bizzlo-program-detail.csv', [detailCourse], selectedStudent)}>
                <Download size={15} />
                Download
              </button>
              <button className="primary-button" type="button" onClick={() => handleApply(detailCourse)}>
                <BookmarkPlus size={15} />
                Apply for student
              </button>
            </footer>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Admin Course Import"
        description="Upload the partner course CSV after the Supabase courses table has been created."
      >
        <div className="catalog-import-grid">
          <section className="import-dropzone">
            <UploadCloud size={22} />
            <strong>Bulk course import</strong>
            <span>CSV imports update matching rows by external ID when supplied, otherwise by course, university, intake, campus, credential, and mode.</span>
            <input accept=".csv,text/csv" type="file" onChange={handleCourseImportFile} />
            {importFileName ? <small>{importFileName}: {importRows.length.toLocaleString()} valid rows ready</small> : null}
            <div className="import-actions">
              <button className="secondary-button" type="button" onClick={handleDownloadTemplate}>
                <Download size={15} />
                Template
              </button>
              <button className="primary-button" type="button" disabled={!importRows.length || submitting || currentUser.role !== 'admin'} onClick={() => handleBulkImport().catch(() => {})}>
                <UploadCloud size={15} />
                {submitting ? 'Importing...' : 'Import / update'}
              </button>
            </div>
            {currentUser.role !== 'admin' ? <small>Only the Videshway admin account can import catalogue rows.</small> : null}
          </section>

          <section className="import-status-panel">
            <strong>Production data gate</strong>
            <span>Seed Supabase with the private partner catalogue before sending partners to Program Search.</span>
            <dl>
              <div><dt>Loaded rows</dt><dd>{catalogStats.total.toLocaleString()}</dd></div>
              <div><dt>Countries</dt><dd>{catalogStats.countries}</dd></div>
              <div><dt>Verified rows</dt><dd>{catalogStats.verified.toLocaleString()}</dd></div>
              <div><dt>Missing links</dt><dd>{catalogStats.missingUrl.toLocaleString()}</dd></div>
            </dl>
          </section>
        </div>
        {importErrors.length ? (
          <div className="import-message warning">
            <AlertCircle size={16} />
            <span>{importErrors.slice(0, 3).join(' · ')}{importErrors.length > 3 ? ` · ${importErrors.length - 3} more` : ''}</span>
          </div>
        ) : null}
        {importResult ? (
          <div className="import-message success">
            <CheckCircle2 size={16} />
            <span>
              Import complete: {importResult.created} added, {importResult.updated} updated, {importResult.skipped} skipped, {importResult.failed} failed.
            </span>
          </div>
        ) : null}
      </Modal>

      {showAdminCatalogTools && currentUser.role === 'admin' ? (
        <>
          <Panel
            title="Partner Catalogue Readiness"
            description="Import partner programme exports and university updates before deployment."
            action={(
              <button className="secondary-button" type="button" onClick={handleExportCatalog}>
                <FileDown size={15} />
                Export catalog
              </button>
            )}
          >
            <div className="catalog-readiness-grid">
              <article>
                <Database size={18} />
                <strong>{catalogStats.total.toLocaleString()}</strong>
                <span>Loaded programmes</span>
              </article>
              <article>
                <ClipboardCheck size={18} />
                <strong>{catalogStats.verified.toLocaleString()}</strong>
                <span>Verified rows</span>
              </article>
              <article>
                <GraduationCap size={18} />
                <strong>{catalogStats.universities.toLocaleString()}</strong>
                <span>Institution entries</span>
              </article>
              <article>
                <AlertCircle size={18} />
                <strong>{catalogStats.missingUrl.toLocaleString()}</strong>
                <span>Missing programme links</span>
              </article>
            </div>

            <div className="catalog-import-grid">
              <section className="import-dropzone">
                <UploadCloud size={22} />
                <strong>Bulk course import</strong>
                <span>CSV imports update matching rows by external ID when supplied, otherwise by course, university, intake, campus, credential, and mode.</span>
                <input accept=".csv,text/csv" type="file" onChange={handleCourseImportFile} />
                {importFileName ? <small>{importFileName}: {importRows.length.toLocaleString()} valid rows ready</small> : null}
                <div className="import-actions">
                  <button className="secondary-button" type="button" onClick={handleDownloadTemplate}>
                    <Download size={15} />
                    Template
                  </button>
                  <button className="primary-button" type="button" disabled={!importRows.length || submitting} onClick={() => handleBulkImport().catch(() => {})}>
                    <UploadCloud size={15} />
                    {submitting ? 'Importing...' : 'Import / update'}
                  </button>
                </div>
              </section>

              <section className="import-status-panel">
                <strong>Deployment data gate</strong>
                <span>
                  Bizzlo is deployment-ready only after the partner catalogue is imported and missing links, tuition, and deadline rows are reviewed.
                </span>
                <dl>
                  <div><dt>Readiness</dt><dd>{catalogStats.readiness}%</dd></div>
                  <div><dt>Missing tuition</dt><dd>{catalogStats.missingTuition.toLocaleString()}</dd></div>
                  <div><dt>Missing deadline</dt><dd>{catalogStats.missingDeadline.toLocaleString()}</dd></div>
                  <div><dt>Countries</dt><dd>{catalogStats.countries}</dd></div>
                </dl>
              </section>
            </div>

            {importErrors.length ? (
              <div className="import-message warning">
                <AlertCircle size={16} />
                <span>{importErrors.slice(0, 3).join(' · ')}{importErrors.length > 3 ? ` · ${importErrors.length - 3} more` : ''}</span>
              </div>
            ) : null}

            {importResult ? (
              <div className="import-message success">
                <CheckCircle2 size={16} />
                <span>
                  Import complete: {importResult.created} added, {importResult.updated} updated, {importResult.skipped} skipped, {importResult.failed} failed.
                </span>
              </div>
            ) : null}

            <div className="source-feed-grid">
              {officialFeedTargets.map((feed) => (
                <article key={feed.country}>
                  <strong>{feed.country}</strong>
                  <span>{feed.rows} rows · {feed.status}</span>
                  <small>{feed.source}</small>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="University Course List" description="Videshway admin can add partner-specific programmes to the managed catalogue.">
            <form className="form-grid compact-form" onSubmit={handleAddCourse}>
              <TextInput label="University" required value={courseForm.university} onChange={(event) => setCourseForm({ ...courseForm, university: event.target.value })} />
              <TextInput label="Course" required value={courseForm.course} onChange={(event) => setCourseForm({ ...courseForm, course: event.target.value })} />
              <SelectInput label="Country" value={courseForm.country} onChange={(event) => setCourseForm({ ...courseForm, country: event.target.value })}>
                {adminCountries.map((item) => <option key={item}>{item}</option>)}
                <option>Canada</option>
              </SelectInput>
              <TextInput label="City" value={courseForm.city} onChange={(event) => setCourseForm({ ...courseForm, city: event.target.value })} />
              <SelectInput label="Level" value={courseForm.level} onChange={(event) => setCourseForm({ ...courseForm, level: event.target.value })}>
                <option>Undergraduate</option>
                <option>Postgraduate</option>
                <option>PhD</option>
              </SelectInput>
              <TextInput label="Subject" value={courseForm.subject} onChange={(event) => setCourseForm({ ...courseForm, subject: event.target.value })} />
              <SelectInput label="Intake" value={courseForm.intake} onChange={(event) => setCourseForm({ ...courseForm, intake: event.target.value })}>
                {intakeOptions.map((item) => <option key={item}>{item}</option>)}
              </SelectInput>
              <TextInput label="Tuition" value={courseForm.tuition} onChange={(event) => setCourseForm({ ...courseForm, tuition: event.target.value })} />
              <TextInput label="Application fee" value={courseForm.application_fee} onChange={(event) => setCourseForm({ ...courseForm, application_fee: event.target.value })} />
              <TextInput label="Programme URL" value={courseForm.source_url} onChange={(event) => setCourseForm({ ...courseForm, source_url: event.target.value })} />
              <TextInput label="Listing name" value={courseForm.source_name} onChange={(event) => setCourseForm({ ...courseForm, source_name: event.target.value })} />
              <label className="checkbox-field">
                <input type="checkbox" checked={courseForm.is_verified} onChange={(event) => setCourseForm({ ...courseForm, is_verified: event.target.checked })} />
                PDF listed
              </label>
              <footer className="form-footer">
                <button className="primary-button" type="submit" disabled={submitting}>
                  <SlidersHorizontal size={16} />
                  {submitting ? 'Adding...' : 'Add programme'}
                </button>
              </footer>
            </form>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
