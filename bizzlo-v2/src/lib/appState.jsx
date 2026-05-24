import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  seedApplications,
  seedApplicationNotes,
  seedAccountRequests,
  seedCommissions,
  seedCourses,
  seedDocuments,
  seedOrganizations,
  seedPartnerFinanceProfiles,
  seedStudents,
  seedTasks,
  seedUsers,
} from '../data/seed';
import { isSupabaseConfigured, supabase } from './supabase';
import { loadCountryCourseCatalog, loadOfficialCourseCatalog } from './courseLoader';
import { captureEvent } from './telemetry';

const AppStateContext = createContext(null);
const documentBucket = 'student-documents';
const courseCatalogPageSize = 5000;
const courseCatalogUiFlushRows = 5000;
const courseCatalogMaxRows = 75000;
const partnerEditableStatuses = new Set([
  'profile_incomplete',
  'documents_pending',
  'ready_for_admin_review',
  'pending_admin_review',
  'admin_changes_requested',
  'rejected',
]);

function mapProfile(profile) {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    portal_username: profile.portal_username || '',
    role: profile.role,
    organization_id: profile.organization_id,
    manager_id: profile.manager_id,
  };
}

function splitCountries(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function bytesToLabel(bytes) {
  if (!bytes) return 'Pending scan';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeFilename(name) {
  return (name || 'document.pdf')
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function mapDocument(document) {
  return {
    ...document,
    type: document.document_type || document.type,
    filename: document.original_filename || document.filename,
    size: document.size || bytesToLabel(document.file_size),
    note: document.rejection_reason || document.note || '',
    scan_status: document.scan_status || 'skipped',
    uploaded_at: document.created_at || document.uploaded_at,
    reviewed_at: document.reviewed_at,
  };
}

function mapCourse(course) {
  return {
    ...course,
    eligibility: course.eligibility_notes || course.eligibility || 'Review eligibility',
    partner_note: course.partner_note || course.commission_hint || '',
    english_requirement: course.english_requirement || '',
    academic_requirement: course.academic_requirement || '',
    application_fee: course.application_fee || '',
    source_url: course.source_url || '',
    source_name: course.source_name || '',
    external_course_id: course.external_course_id || '',
    catalog_key: course.catalog_key || courseIdentityKey(course),
    is_verified: Boolean(course.is_verified),
  };
}

function normalizeCourseValue(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizePortalUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 48);
}

function partnerPortalUsername(partner) {
  const explicit = normalizePortalUsername(partner.portal_username);
  if (explicit) return explicit;
  const company = normalizePortalUsername(partner.organization_name);
  if (company) return company;
  return normalizePortalUsername(partner.email?.split('@')[0] || partner.full_name);
}

function portalLoginEmail(username) {
  return `${normalizePortalUsername(username)}@portal.bizzlo.co`;
}

function loginEmailCandidatesForIdentifier(identifier) {
  const value = String(identifier || '').trim();
  if (!value) return [''];
  if (!value.includes('@')) return [portalLoginEmail(value)];
  const email = value.toLowerCase();
  const usernameFallback = portalLoginEmail(email.split('@')[0]);
  return Array.from(new Set([email, usernameFallback].filter(Boolean)));
}

function loginEmailForIdentifier(identifier) {
  return loginEmailCandidatesForIdentifier(identifier)[0];
}

function validateInitialPassword(password) {
  if (String(password || '').length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
}

function makeStudentCode(existingStudents = []) {
  const year = new Date().getFullYear();
  const existingCodes = new Set(existingStudents.map((student) => student.student_code).filter(Boolean));

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const timePart = Date.now().toString(36).toUpperCase().slice(-6);
    const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
    const candidate = `BZ-${year}-${timePart}${randomPart}`;
    if (!existingCodes.has(candidate)) return candidate;
  }

  return `BZ-${year}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function courseIdentityKey(course) {
  if (course.catalog_key) return normalizeCourseValue(course.catalog_key).toLowerCase();
  if (course.external_course_id) {
    return ['external', course.source_name || course.source_url || 'source', course.external_course_id]
      .map((value) => normalizeCourseValue(value).toLowerCase())
      .join('|');
  }
  if (course.id && !String(course.id).includes('null') && !/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(String(course.id))) {
    return ['source-row', course.id].map((value) => normalizeCourseValue(value).toLowerCase()).join('|');
  }

  return ['country', 'university', 'course', 'level', 'intake', 'campus', 'credential', 'mode']
    .map((field) => normalizeCourseValue(course[field]).toLowerCase())
    .join('|');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function normalizeCourseRecord(course, index = 0) {
  const normalized = {
    ...course,
    country: normalizeCourseValue(course.country),
    university: normalizeCourseValue(course.university),
    course: normalizeCourseValue(course.course),
    level: normalizeCourseValue(course.level),
    city: normalizeCourseValue(course.city),
    campus: normalizeCourseValue(course.campus || course.city),
    subject: normalizeCourseValue(course.subject),
    credential: normalizeCourseValue(course.credential),
    duration: normalizeCourseValue(course.duration),
    mode: normalizeCourseValue(course.mode) || 'On campus',
    intake: normalizeCourseValue(course.intake),
    tuition: normalizeCourseValue(course.tuition),
    application_fee: normalizeCourseValue(course.application_fee),
    deadline: normalizeCourseValue(course.deadline),
    commission_hint: normalizeCourseValue(course.commission_hint),
    partner_note: normalizeCourseValue(course.partner_note || course.commission_hint),
    eligibility: normalizeCourseValue(course.eligibility || course.eligibility_notes) || 'Review eligibility',
    english_requirement: normalizeCourseValue(course.english_requirement),
    academic_requirement: normalizeCourseValue(course.academic_requirement),
    scholarship: normalizeCourseValue(course.scholarship),
    source_url: normalizeCourseValue(course.source_url),
    source_name: normalizeCourseValue(course.source_name),
    external_course_id: normalizeCourseValue(course.external_course_id),
    source_updated_at: normalizeCourseValue(course.source_updated_at) || new Date().toISOString().slice(0, 10),
    is_verified: Boolean(course.is_verified),
    is_active: course.is_active ?? true,
  };

  const catalogKey = normalizeCourseValue(course.catalog_key) || courseIdentityKey(normalized);
  return {
    ...normalized,
    catalog_key: catalogKey,
    id: course.id || `course-import-${Date.now()}-${index}`,
  };
}

function coursePayload(course) {
  const normalized = normalizeCourseRecord(course);
  return {
    catalog_key: normalized.catalog_key,
    external_course_id: normalized.external_course_id,
    source_name: normalized.source_name,
    university: normalized.university,
    country: normalized.country,
    city: normalized.city,
    campus: normalized.campus,
    level: normalized.level,
    subject: normalized.subject,
    course: normalized.course,
    credential: normalized.credential,
    duration: normalized.duration,
    mode: normalized.mode,
    intake: normalized.intake,
    tuition: normalized.tuition,
    application_fee: normalized.application_fee,
    deadline: normalized.deadline || null,
    commission_hint: normalized.partner_note || normalized.commission_hint,
    eligibility_notes: normalized.eligibility,
    english_requirement: normalized.english_requirement,
    academic_requirement: normalized.academic_requirement,
    scholarship: normalized.scholarship,
    source_url: normalized.source_url,
    source_updated_at: normalized.source_updated_at,
    is_verified: normalized.is_verified,
    is_active: true,
  };
}

function isPartnerCatalogCourse(course) {
  return Boolean(course.partner_university_id) || /partner/i.test(course.source_name || '');
}

function mergeCourseRows(currentRows, incomingRows) {
  const byKey = new Map();
  const merged = [];

  [...currentRows, ...incomingRows].forEach((course) => {
    const key = course.catalog_key || courseIdentityKey(course);
    if (!key) return;
    if (byKey.has(key)) {
      const index = byKey.get(key);
      merged[index] = { ...merged[index], ...course };
      return;
    }
    byKey.set(key, merged.length);
    merged.push(course);
  });

  return merged;
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function mapTask(task, users) {
  const owner = users.find((user) => user.id === task.assigned_to)?.name;
  return {
    ...task,
    due: task.due_date || task.due,
    owner: owner || task.owner || 'Assigned user',
  };
}

function mapCommission(commission) {
  return {
    ...commission,
    student_id: commission.application?.student_id || commission.student_id,
    university: commission.application?.university || commission.university,
    course: commission.application?.course || commission.course,
  };
}

function mapApplicationNote(event) {
  return {
    id: event.id,
    application_id: event.application_id,
    author_id: event.actor_id,
    author_name: event.actor?.full_name || event.author_name || 'Bizzlo user',
    body: event.note || event.body || '',
    status: event.status,
    created_at: event.created_at,
  };
}

function mapServiceRequest(request) {
  return {
    ...request,
    requester_name: request.requester?.full_name || request.requester_name || 'Bizzlo user',
  };
}

function mapSupportTicket(ticket) {
  return {
    ...ticket,
    requester_name: ticket.creator?.full_name || ticket.requester_name || 'Bizzlo user',
  };
}

function mapAuditEvent(event) {
  return {
    ...event,
    actor_name: event.actor?.full_name || 'System',
  };
}

function errorMessage(error) {
  return error?.message || 'Something went wrong. Please try again.';
}

function sortNewest(items) {
  return [...items].sort((a, b) => String(b.created_at || b.updated_at || '').localeCompare(String(a.created_at || a.updated_at || '')));
}

function requireUser(user) {
  if (!user) throw new Error('Please sign in before continuing.');
}

function makeInviteToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function studentInviteUrl(student, token) {
  const code = encodeURIComponent(String(student.student_code || student.id).toLowerCase());
  return `${window.location.origin}/portal/${code}?token=${encodeURIComponent(token)}`;
}

function scopedByRole(items, user) {
  if (!user) return [];
  if (user.role === 'admin') return items;
  if (user.role === 'manager') return items.filter((item) => item.manager_id === user.id);
  if (user.role === 'counselor') return items.filter((item) => item.counselor_id === user.id || item.uploaded_by === user.id);
  return [];
}

function applicationWorkflowPatch(status) {
  const patch = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (['deposit_paid', 'cas_issued', 'visa_filed', 'visa_granted', 'enrolled'].includes(status)) {
    patch.deposit_status = 'paid';
  }

  return patch;
}

export function AppStateProvider({ children }) {
  const allowDemoMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO === 'true';
  const isDemoMode = !isSupabaseConfigured && allowDemoMode;
  const isProductionMisconfigured = !isSupabaseConfigured && !allowDemoMode;
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [dataLoading, setDataLoading] = useState(false);
  const [appError, setAppError] = useState('');
  const [organizations, setOrganizations] = useState(seedOrganizations);
  const [accountRequests, setAccountRequests] = useState(seedAccountRequests);
  const [users, setUsers] = useState(seedUsers);
  const [currentUser, setCurrentUser] = useState(isDemoMode ? seedUsers[1] : null);
  const [students, setStudents] = useState(seedStudents);
  const [applications, setApplications] = useState(seedApplications);
  const [applicationNotes, setApplicationNotes] = useState(seedApplicationNotes);
  const [documents, setDocuments] = useState(seedDocuments);
  const [courses, setCourses] = useState(seedCourses);
  const [courseCatalogStatus, setCourseCatalogStatus] = useState(() => ({
    isLoadingFull: false,
    isFullCatalogLoaded: !isSupabaseConfigured,
    totalLoaded: seedCourses.length,
    totalAvailable: seedCourses.length,
    lastError: '',
  }));
  const [loadedCatalogCountries, setLoadedCatalogCountries] = useState(new Set());
  const [catalogLoadingCountry, setCatalogLoadingCountry] = useState('');
  const [tasks, setTasks] = useState(seedTasks);
  const [commissions, setCommissions] = useState(seedCommissions);
  const [partnerFinanceProfiles, setPartnerFinanceProfiles] = useState(seedPartnerFinanceProfiles);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [studentInvites, setStudentInvites] = useState([]);
  const [completedTrainingModules, setCompletedTrainingModules] = useState([]);
  const [activeInviteStudentId, setActiveInviteStudentId] = useState('');
  const [activeInviteUrl, setActiveInviteUrl] = useState('');
  const fullCatalogLoadRef = useRef(null);
  const fullCatalogLoadedRef = useRef(!isSupabaseConfigured);

  useEffect(() => {
    if (!isDemoMode) return undefined;

    let active = true;
    loadOfficialCourseCatalog().then((officialCourses) => {
      if (!active) return;
      if (officialCourses.length) {
        setCourses(officialCourses);
        setLoadedCatalogCountries(new Set(officialCourses.filter((course) => course.is_verified).map((course) => course.country)));
      }
    });

    return () => {
      active = false;
    };
  }, [isDemoMode]);

  const loadCatalogCountry = useCallback(async (country) => {
    if (!isDemoMode || !country || country === 'All' || loadedCatalogCountries.has(country)) return;

    setCatalogLoadingCountry(country);
    const countryRows = await loadCountryCourseCatalog(country);
    if (countryRows.length) {
      setCourses((current) => {
        const retained = current.filter((course) => course.country !== country || isPartnerCatalogCourse(course));
        const retainedKeys = new Set(retained.map((course) => course.catalog_key || courseIdentityKey(course)));
        const incoming = countryRows.filter((course) => !retainedKeys.has(course.catalog_key || courseIdentityKey(course)));
        return [...retained, ...incoming];
      });
      setLoadedCatalogCountries((current) => new Set([...current, country]));
    }
    setCatalogLoadingCountry('');
  }, [isDemoMode, loadedCatalogCountries]);

  const loadFullCourseCatalog = useCallback(async (options = {}) => {
    if (!isSupabaseConfigured) {
      fullCatalogLoadedRef.current = true;
      setCourseCatalogStatus({
        isLoadingFull: false,
        isFullCatalogLoaded: true,
        totalLoaded: seedCourses.length,
        totalAvailable: seedCourses.length,
        lastError: '',
      });
      return seedCourses;
    }

    if (fullCatalogLoadRef.current && !options.force) return fullCatalogLoadRef.current;
    if (fullCatalogLoadedRef.current && !options.force) return [];

    const promise = (async () => {
      setCourseCatalogStatus((current) => ({
        ...current,
        isLoadingFull: true,
        lastError: '',
      }));

      const loadedRows = [];
      let pendingRows = [];
      let totalAvailable = 0;
      let offset = 0;
      let effectivePageSize = courseCatalogPageSize;

      while (offset < courseCatalogMaxRows) {
        const selectOptions = offset === 0 ? { count: 'exact' } : undefined;
        const { data, error, count } = await supabase
          .from('courses')
          .select('*', selectOptions)
          .eq('is_active', true)
          .order('catalog_key', { ascending: true })
          .range(offset, offset + effectivePageSize - 1);

        if (error) throw error;

        const mappedRows = (data || []).map(mapCourse);
        if (offset === 0) totalAvailable = count || mappedRows.length;
        if (!mappedRows.length) break;

        if (mappedRows.length < effectivePageSize && totalAvailable > mappedRows.length && offset === 0) {
          effectivePageSize = mappedRows.length;
        }

        loadedRows.push(...mappedRows);
        pendingRows.push(...mappedRows);
        const shouldFlushRows =
          pendingRows.length >= courseCatalogUiFlushRows ||
          (totalAvailable && loadedRows.length >= totalAvailable) ||
          mappedRows.length < effectivePageSize;

        if (shouldFlushRows) {
          const rowsToFlush = pendingRows;
          pendingRows = [];
          setCourses((current) => mergeCourseRows(current, rowsToFlush));
        }

        setCourseCatalogStatus((current) => ({
          ...current,
          totalLoaded: loadedRows.length,
          totalAvailable: Math.max(totalAvailable, loadedRows.length),
        }));

        offset += mappedRows.length;

        if (mappedRows.length < effectivePageSize) break;
        if (totalAvailable && loadedRows.length >= totalAvailable) break;
      }

      if (pendingRows.length) {
        setCourses((current) => mergeCourseRows(current, pendingRows));
      }

      setCourseCatalogStatus({
        isLoadingFull: false,
        isFullCatalogLoaded: true,
        totalLoaded: loadedRows.length,
        totalAvailable: Math.max(totalAvailable, loadedRows.length),
        lastError: '',
      });
      fullCatalogLoadedRef.current = true;
      return loadedRows;
    })();

    fullCatalogLoadRef.current = promise;
    try {
      return await promise;
    } catch (error) {
      setCourseCatalogStatus((current) => ({
        ...current,
        isLoadingFull: false,
        lastError: errorMessage(error),
      }));
      fullCatalogLoadedRef.current = false;
      throw error;
    } finally {
      fullCatalogLoadRef.current = null;
    }
  }, []);

  const loadCourseCatalogCount = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setCourseCatalogStatus((current) => ({
        ...current,
        totalLoaded: seedCourses.length,
        totalAvailable: seedCourses.length,
      }));
      return seedCourses.length;
    }

    const { count, error } = await supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) {
      setCourseCatalogStatus((current) => ({
        ...current,
        lastError: errorMessage(error),
      }));
      throw error;
    }

    setCourseCatalogStatus((current) => ({
      ...current,
      totalLoaded: Math.max(current.totalLoaded || 0, courses.length),
      totalAvailable: count || 0,
      lastError: '',
    }));
    return count || 0;
  }, [courses.length]);

  const loadDocuments = useCallback(async () => {
    if (!isSupabaseConfigured || !currentUser) return [];

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 249);

    if (error) {
      setAppError(errorMessage(error));
      throw error;
    }

    const mappedDocuments = (data || []).map(mapDocument);
    setDocuments(mappedDocuments);
    return mappedDocuments;
  }, [currentUser]);

  const loadData = useCallback(async (profile) => {
    if (!isSupabaseConfigured || !profile) return;

    setDataLoading(true);
    setAppError('');
    try {
      const isAdminProfile = profile.role === 'admin';
      const isCounselorProfile = profile.role === 'counselor';
      const [
        profilesResult,
        organizationsResult,
        accountRequestsResult,
        studentsResult,
        applicationsResult,
        applicationEventsResult,
        documentsResult,
        coursesResult,
        tasksResult,
        commissionsResult,
        financeProfilesResult,
        serviceRequestsResult,
        supportTicketsResult,
        trainingProgressResult,
        auditEventsResult,
        studentInvitesResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, organization_id, manager_id, full_name, email, role, is_active, portal_username')
          .eq('is_active', true)
          .order('full_name')
          .range(0, 249),
        isAdminProfile
          ? supabase.from('organizations').select('*').order('created_at', { ascending: false }).range(0, 199)
          : supabase.from('organizations').select('*').eq('id', profile.organization_id).range(0, 0),
        supabase.from('account_requests').select('*').order('created_at', { ascending: false }).range(0, 199),
        supabase.from('students').select('*').order('updated_at', { ascending: false }).range(0, 49),
        supabase.from('applications').select('*').order('updated_at', { ascending: false }).range(0, 49),
        supabase
          .from('application_events')
          .select('*, actor:profiles(full_name)')
          .order('created_at', { ascending: false })
          .range(0, 199),
        supabase.from('documents').select('*').order('created_at', { ascending: false }).range(0, 249),
        supabase.rpc('search_courses', {
          filter_country: 'All',
          filter_level: 'All',
          filter_intake: 'September',
          filter_query: '',
          page_limit: 100,
          page_offset: 0,
        }),
        supabase.from('tasks').select('*').order('status', { ascending: true }).order('due_date', { ascending: true }).range(0, 99),
        isCounselorProfile
          ? Promise.resolve({ data: [], error: null })
          : supabase
            .from('commissions')
            .select('*, application:applications(student_id, university, course)')
            .order('updated_at', { ascending: false })
            .range(0, 199),
        isCounselorProfile
          ? Promise.resolve({ data: [], error: null })
          : supabase.from('partner_finance_profiles').select('*').order('updated_at', { ascending: false }).range(0, 99),
        supabase
          .from('service_requests')
          .select('*, requester:profiles(full_name)')
          .order('created_at', { ascending: false })
          .range(0, 99),
        supabase
          .from('support_tickets')
          .select('*, creator:profiles(full_name)')
          .order('created_at', { ascending: false })
          .range(0, 99),
        supabase
          .from('training_progress')
          .select('*')
          .eq('user_id', profile.id)
          .order('completed_at', { ascending: false }),
        isAdminProfile
          ? supabase
            .from('audit_events')
            .select('*, actor:profiles(full_name)')
            .order('created_at', { ascending: false })
            .range(0, 499)
          : Promise.resolve({ data: [], error: null }),
        supabase.from('student_invites').select('*').order('created_at', { ascending: false }).range(0, 99),
      ]);

      const firstError = [
        profilesResult,
        organizationsResult,
        accountRequestsResult,
        studentsResult,
        applicationsResult,
        applicationEventsResult,
        documentsResult,
        coursesResult,
        tasksResult,
        commissionsResult,
        financeProfilesResult,
        serviceRequestsResult,
        supportTicketsResult,
        trainingProgressResult,
        auditEventsResult,
        studentInvitesResult,
      ].find((result) => result.error)?.error;

      if (firstError) throw firstError;

      const mappedUsers = profilesResult.data.map(mapProfile);
      setUsers(mappedUsers);
      setOrganizations(organizationsResult.data || []);
      setAccountRequests(accountRequestsResult.data || []);
      setStudents(studentsResult.data || []);
      setApplications(applicationsResult.data || []);
      setApplicationNotes((applicationEventsResult.data || []).map(mapApplicationNote));
      setDocuments((documentsResult.data || []).map(mapDocument));
      const databaseCourses = (coursesResult.data || []).map(mapCourse);
      setCourses((current) => {
        if (!databaseCourses.length) return [];
        return current.length > databaseCourses.length
          ? mergeCourseRows(current, databaseCourses)
          : databaseCourses;
      });
      setCourseCatalogStatus((current) => ({
        ...current,
        totalLoaded: Math.max(current.totalLoaded, databaseCourses.length),
        totalAvailable: Math.max(current.totalAvailable, databaseCourses.length),
      }));
      setTasks((tasksResult.data || []).map((task) => mapTask(task, mappedUsers)));
      setCommissions((commissionsResult.data || []).map(mapCommission));
      setPartnerFinanceProfiles(financeProfilesResult.data || []);
      setServiceRequests((serviceRequestsResult.data || []).map(mapServiceRequest));
      setSupportTickets((supportTicketsResult.data || []).map(mapSupportTicket));
      setCompletedTrainingModules((trainingProgressResult.data || []).map((row) => row.module_title));
      setAuditEvents((auditEventsResult.data || []).map(mapAuditEvent));
      setStudentInvites(studentInvitesResult.data || []);
    } catch (error) {
      setAppError(errorMessage(error));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setAppError(error.message);
      setSession(data.session || null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setCurrentUser(null);
        setOrganizations([]);
        setAccountRequests([]);
        setUsers([]);
        setStudents([]);
        setApplications([]);
        setApplicationNotes([]);
        setDocuments([]);
        setCourses([]);
        fullCatalogLoadedRef.current = false;
        setCourseCatalogStatus({
          isLoadingFull: false,
          isFullCatalogLoaded: false,
          totalLoaded: 0,
          totalAvailable: 0,
          lastError: '',
        });
        setTasks([]);
        setCommissions([]);
        setPartnerFinanceProfiles([]);
        setServiceRequests([]);
        setSupportTickets([]);
        setAuditEvents([]);
        setStudentInvites([]);
        setCompletedTrainingModules([]);
        setActiveInviteStudentId('');
        setActiveInviteUrl('');
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !session?.user) return;

    let active = true;
    async function loadProfile() {
      setAuthLoading(true);
      setAppError('');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, organization_id, manager_id, full_name, email, role, is_active, portal_username')
        .eq('id', session.user.id)
        .eq('is_active', true)
        .single();

      if (!active) return;

      if (error) {
        setCurrentUser(null);
        setAppError('Your login works, but no active Bizzlo profile was found for this account.');
        setAuthLoading(false);
        return;
      }

      const profile = mapProfile(data);
      setCurrentUser(profile);
      setAuthLoading(false);
      await loadData(profile);
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [loadData, session]);

  const refreshData = useCallback(async () => {
    await loadData(currentUser);
  }, [currentUser, loadData]);
  const refreshDataRef = useRef(refreshData);
  const refreshDocumentsRef = useRef(loadDocuments);

  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  useEffect(() => {
    refreshDocumentsRef.current = loadDocuments;
  }, [loadDocuments]);

  const currentUserId = currentUser?.id;

  useEffect(() => {
    if (!isSupabaseConfigured || !currentUserId) return undefined;

    let refreshTimer = null;
    let documentsRefreshTimer = null;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshDataRef.current().catch(() => {});
      }, 350);
    };
    const scheduleDocumentsRefresh = () => {
      window.clearTimeout(documentsRefreshTimer);
      documentsRefreshTimer = window.setTimeout(() => {
        refreshDocumentsRef.current().catch(() => {});
      }, 250);
    };

    const channel = supabase
      .channel(`bizzlo-live-${currentUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, scheduleDocumentsRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'application_events' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commissions' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_invites' }, scheduleRefresh);

    if (currentUser?.role === 'admin') {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'audit_events' }, scheduleRefresh);
    }

    channel
      .subscribe();

    return () => {
      window.clearTimeout(refreshTimer);
      window.clearTimeout(documentsRefreshTimer);
      supabase.removeChannel(channel);
    };
  }, [currentUser?.role, currentUserId]);

  const logAuditEvent = useCallback(async (entityType, entityId, action, metadata = {}) => {
    if (!isSupabaseConfigured || !currentUser) return;
    await supabase.rpc('log_audit_event', {
      entity_type: entityType,
      entity_id: entityId || null,
      action,
      metadata,
    }).catch(() => {});
  }, [currentUser]);

  async function signIn(email, password) {
    if (!isSupabaseConfigured) return;

    setAuthLoading(true);
    setAppError('');
    const loginCandidates = loginEmailCandidatesForIdentifier(email);
    let lastError = null;

    for (const loginEmail of loginCandidates) {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (!error) {
        await supabase.rpc('log_audit_event', {
          entity_type: 'auth',
          entity_id: null,
          action: 'sign_in',
          metadata: { login_identifier: email, login_email: loginEmail },
        }).catch(() => {});
        captureEvent('sign_in', {}, currentUser);
        return;
      }
      lastError = error;
    }

    setAuthLoading(false);
    setAppError(lastError?.message || 'Invalid login credentials');
    throw lastError || new Error('Invalid login credentials');
  }

  async function signOut() {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
  }

  async function resetPassword(email) {
    if (!isSupabaseConfigured) return;
    setAppError('');
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmailForIdentifier(email), {
      redirectTo: window.location.origin,
    });
    if (error) {
      setAppError(error.message);
      throw error;
    }
  }

  const counselors = useMemo(() => users.filter((user) => user.role === 'counselor'), [users]);
  const managers = useMemo(() => users.filter((user) => user.role === 'manager'), [users]);
  const visibleOrganizations = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return organizations;
    return organizations.filter((organization) => organization.id === currentUser.organization_id);
  }, [currentUser, organizations]);
  const visibleAccountRequests = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return accountRequests;
    return accountRequests.filter((request) => request.organization_id === currentUser.organization_id || request.requested_by === currentUser.id);
  }, [accountRequests, currentUser]);
  const managerCounselors = useMemo(() => {
    if (!currentUser) return [];
    return counselors.filter((user) => user.manager_id === currentUser.id || user.organization_id === currentUser.organization_id);
  }, [counselors, currentUser]);

  const visibleStudents = useMemo(() => {
    if (!currentUser) return [];
    if (isSupabaseConfigured) return students;
    if (currentUser.role === 'admin') return students;
    if (currentUser.role === 'manager') return students.filter((student) => student.manager_id === currentUser.id);
    return students.filter((student) => student.counselor_id === currentUser.id);
  }, [currentUser, students]);

  const visibleApplications = useMemo(() => {
    if (!currentUser) return [];
    if (isSupabaseConfigured) return applications;
    const visibleStudentIds = new Set(visibleStudents.map((student) => student.id));
    return applications.filter((application) => visibleStudentIds.has(application.student_id));
  }, [applications, currentUser, visibleStudents]);

  const visibleApplicationNotes = useMemo(() => {
    if (!currentUser) return [];
    const visibleApplicationIds = new Set(visibleApplications.map((application) => application.id));
    return applicationNotes
      .filter((note) => visibleApplicationIds.has(note.application_id))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }, [applicationNotes, currentUser, visibleApplications]);

  const visibleDocuments = useMemo(() => {
    if (!currentUser) return [];
    if (isSupabaseConfigured) return documents;
    const visibleStudentIds = new Set(visibleStudents.map((student) => student.id));
    return documents.filter((document) => visibleStudentIds.has(document.student_id));
  }, [currentUser, documents, visibleStudents]);

  const visibleTasks = useMemo(() => {
    if (!currentUser) return [];
    if (isSupabaseConfigured) return tasks;
    const visibleStudentIds = new Set(visibleStudents.map((student) => student.id));
    return tasks.filter((task) => visibleStudentIds.has(task.student_id) || currentUser.role === 'admin');
  }, [currentUser, tasks, visibleStudents]);

  const visibleCommissions = useMemo(() => {
    if (!currentUser || currentUser.role === 'counselor') return [];
    if (isSupabaseConfigured) return commissions;
    return scopedByRole(commissions, currentUser);
  }, [commissions, currentUser]);

  const visiblePartnerFinanceProfiles = useMemo(() => {
    if (!currentUser || currentUser.role === 'counselor') return [];
    if (currentUser.role === 'admin') return partnerFinanceProfiles;
    return partnerFinanceProfiles.filter((profile) => (
      profile.organization_id === currentUser.organization_id || profile.manager_id === currentUser.id
    ));
  }, [currentUser, partnerFinanceProfiles]);

  async function addStudent(student) {
    requireUser(currentUser);
    setAppError('');

    const selectedCounselor = users.find((user) => user.id === student.counselor_id);
    const desiredCountries = splitCountries(student.desired_countries);
    const managerId = currentUser.role === 'manager'
      ? currentUser.id
      : selectedCounselor?.manager_id || currentUser.manager_id || null;
    const counselorId = currentUser.role === 'counselor'
      ? currentUser.id
      : student.counselor_id || selectedCounselor?.id || null;
    const organizationId = currentUser.organization_id || selectedCounselor?.organization_id;

    if (!isSupabaseConfigured) {
      const nextStudent = {
        id: `stu-${Date.now()}`,
        student_code: makeStudentCode(students),
        profile_score: 38,
        status: 'profile_incomplete',
        manager_id: managerId || 'u-manager',
        counselor_id: counselorId || 'u-counselor',
        ...student,
        desired_countries: desiredCountries,
      };
      setStudents((prev) => [nextStudent, ...prev]);
      captureEvent('student_created', { mode: 'demo' }, currentUser);
      return nextStudent;
    }

    const payload = {
      organization_id: organizationId,
      manager_id: managerId,
      counselor_id: counselorId,
      student_code: makeStudentCode(students),
      first_name: student.first_name,
      last_name: student.last_name,
      email: student.email,
      phone: student.phone,
      nationality: student.nationality,
      desired_countries: desiredCountries,
      study_level: student.study_level,
      discipline: student.discipline,
      intake: student.intake,
      profile_score: 38,
      status: 'profile_incomplete',
    };

    let data = null;
    let error = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await supabase.from('students').insert(payload).select('*').single();
      data = result.data;
      error = result.error;
      if (!error) break;
      if (error.code === '23505' && String(error.message || '').includes('students_student_code_key')) {
        payload.student_code = makeStudentCode([...students, payload]);
        continue;
      }
      break;
    }
    if (error) {
      setAppError(error.message);
      throw error;
    }
    setStudents((prev) => [data, ...prev]);
    captureEvent('student_created', { student_id: data.id }, currentUser);
    return data;
  }

  async function addPartnerAccount(partner) {
    requireUser(currentUser);
    setAppError('');

    if (currentUser.role !== 'admin') {
      const error = new Error('Only Videshway admin can create partner manager accounts.');
      setAppError(error.message);
      throw error;
    }

    const portalUsername = partnerPortalUsername(partner);
    if (!portalUsername || portalUsername.length < 3) {
      const error = new Error('Add a portal username with at least 3 letters or numbers.');
      setAppError(error.message);
      throw error;
    }
    try {
      validateInitialPassword(partner.initial_password);
    } catch (error) {
      setAppError(error.message);
      throw error;
    }

    if (!isSupabaseConfigured) {
      const organizationId = `org-${Date.now()}`;
      const managerId = `u-manager-${Date.now()}`;
      const organization = {
        id: organizationId,
        name: partner.organization_name,
        kind: 'partner',
        primary_manager_id: managerId,
        counselor_limit: Number(partner.counselor_limit || 1),
        status: 'active',
        created_at: new Date().toISOString(),
      };
      const manager = {
        id: managerId,
        name: partner.full_name,
        email: partner.email,
        portal_username: portalUsername,
        role: 'manager',
        organization_id: organizationId,
      };
      const request = {
        id: `req-${Date.now()}`,
        role: 'manager',
        organization_id: organizationId,
        organization_name: partner.organization_name,
        full_name: partner.full_name,
        email: partner.email,
        portal_username: portalUsername,
        auth_login_email: portalLoginEmail(portalUsername),
        requested_by: currentUser.id,
        status: 'active',
        note: 'Demo manager login created.',
        created_at: new Date().toISOString(),
      };
      setOrganizations((prev) => [organization, ...prev]);
      setUsers((prev) => [manager, ...prev]);
      setAccountRequests((prev) => [request, ...prev]);
      return request;
    }

    const organizationPayload = {
      name: partner.organization_name,
      kind: 'partner',
      counselor_limit: Number(partner.counselor_limit || 1),
      status: 'pending_login_creation',
    };
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert(organizationPayload)
      .select('*')
      .single();

    if (orgError) {
      setAppError(orgError.message);
      throw orgError;
    }

    const requestPayload = {
      role: 'manager',
      organization_id: organization.id,
      organization_name: partner.organization_name,
      full_name: partner.full_name,
      email: partner.email,
      portal_username: portalUsername,
      requested_by: currentUser.id,
      status: 'needs_login_creation',
      note: 'Ready for direct login creation.',
    };
    const { data, error } = await supabase.from('account_requests').insert(requestPayload).select('*').single();
    if (error) {
      setAppError(error.message);
      throw error;
    }
    setOrganizations((prev) => [organization, ...prev]);
    setAccountRequests((prev) => [data, ...prev]);
    const created = await createAccountLogin(data.id, partner.initial_password);
    return { ...data, ...created };
  }

  async function requestCounselorAccount(counselor) {
    requireUser(currentUser);
    setAppError('');

    if (currentUser.role !== 'manager') {
      const error = new Error('Only partner managers can create counselor seats.');
      setAppError(error.message);
      throw error;
    }

    const organization = organizations.find((item) => item.id === currentUser.organization_id);
    const counselorLimit = Number(organization?.counselor_limit || 1);
    const activeCounselors = counselors.filter((user) => user.organization_id === currentUser.organization_id);
    const pendingCounselorRequests = accountRequests.filter((request) => (
      request.organization_id === currentUser.organization_id
      && request.role === 'counselor'
      && !['rejected', 'cancelled'].includes(request.status)
    ));

    if (activeCounselors.length >= counselorLimit || pendingCounselorRequests.length >= counselorLimit) {
      const seatLabel = counselorLimit === 1 ? 'seat' : 'seats';
      const error = new Error(`This partner currently has ${counselorLimit} counselor ${seatLabel}, and all seats are used or pending. Ask Videshway admin to increase the seat limit.`);
      setAppError(error.message);
      throw error;
    }

    const portalUsername = normalizePortalUsername(counselor.portal_username || counselor.email?.split('@')[0] || counselor.full_name);
    if (!portalUsername || portalUsername.length < 3) {
      const error = new Error('Add a counselor portal username with at least 3 letters or numbers.');
      setAppError(error.message);
      throw error;
    }
    try {
      validateInitialPassword(counselor.initial_password);
    } catch (error) {
      setAppError(error.message);
      throw error;
    }

    if (!isSupabaseConfigured) {
      const counselorId = `u-counselor-${Date.now()}`;
      const nextCounselor = {
        id: counselorId,
        name: counselor.full_name,
        email: counselor.email,
        portal_username: portalUsername,
        role: 'counselor',
        manager_id: currentUser.id,
        organization_id: currentUser.organization_id,
      };
      const request = {
        id: `req-${Date.now()}`,
        role: 'counselor',
        organization_id: currentUser.organization_id,
        organization_name: organization?.name || 'Partner',
        manager_id: currentUser.id,
        full_name: counselor.full_name,
        email: counselor.email,
        portal_username: portalUsername,
        auth_login_email: portalLoginEmail(portalUsername),
        requested_by: currentUser.id,
        status: 'active',
        note: 'Demo counselor login created.',
        created_at: new Date().toISOString(),
      };
      setUsers((prev) => [nextCounselor, ...prev]);
      setAccountRequests((prev) => [request, ...prev]);
      return request;
    }

    const payload = {
      role: 'counselor',
      organization_id: currentUser.organization_id,
      organization_name: organization?.name || 'Partner',
      manager_id: currentUser.id,
      full_name: counselor.full_name,
      email: counselor.email,
      portal_username: portalUsername,
      requested_by: currentUser.id,
      status: 'needs_login_creation',
      note: 'Ready for direct counselor login creation.',
    };
    const { data, error } = await supabase.from('account_requests').insert(payload).select('*').single();
    if (error) {
      setAppError(error.message);
      throw error;
    }
    setAccountRequests((prev) => [data, ...prev]);
    const created = await createAccountLogin(data.id, counselor.initial_password, data);
    return { ...data, ...created };
  }

  async function updateAccountRequest(requestId, status) {
    requireUser(currentUser);
    setAppError('');

    const request = accountRequests.find((item) => item.id === requestId);
    const canRequesterCancel = status === 'cancelled' && request?.requested_by === currentUser.id;
    if (currentUser.role !== 'admin' && !canRequesterCancel) {
      const error = new Error('Only Videshway admin can update account requests. Requesters can only cancel their own pending invite.');
      setAppError(error.message);
      throw error;
    }

    if (!isSupabaseConfigured) {
      setAccountRequests((prev) => prev.map((request) => (
        request.id === requestId ? { ...request, status, note: `Marked ${status} by admin.` } : request
      )));
      return;
    }

    const { data, error } = await supabase
      .from('account_requests')
      .update({ status, note: `Marked ${status} by admin.` })
      .eq('id', requestId)
      .select('*')
      .single();
    if (error) {
      setAppError(error.message);
      throw error;
    }
    setAccountRequests((prev) => prev.map((request) => (request.id === requestId ? data : request)));
  }

  async function updatePartnerSeatLimit(organizationId, counselorLimit) {
    requireUser(currentUser);
    setAppError('');

    if (currentUser.role !== 'admin') {
      const error = new Error('Only Videshway admin can change counselor seat limits.');
      setAppError(error.message);
      throw error;
    }

    const nextLimit = Math.max(1, Math.min(10, Number(counselorLimit) || 1));

    if (!isSupabaseConfigured) {
      setOrganizations((prev) => prev.map((organization) => (
        organization.id === organizationId ? { ...organization, counselor_limit: nextLimit } : organization
      )));
      return { id: organizationId, counselor_limit: nextLimit };
    }

    const { data, error } = await supabase
      .from('organizations')
      .update({ counselor_limit: nextLimit })
      .eq('id', organizationId)
      .select('*')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }

    setOrganizations((prev) => prev.map((organization) => (organization.id === organizationId ? data : organization)));
    logAuditEvent('system', organizationId, 'partner_seat_limit_updated', { counselor_limit: nextLimit }).catch(() => {});
    return data;
  }

  async function createAccountLogin(requestId, password, requestOverride = null) {
    requireUser(currentUser);
    setAppError('');

    try {
      validateInitialPassword(password);
    } catch (error) {
      setAppError(error.message);
      throw error;
    }

    const request = requestOverride || accountRequests.find((item) => item.id === requestId);
    const canManagerCreateCounselor = currentUser.role === 'manager'
      && request?.role === 'counselor'
      && request?.requested_by === currentUser.id;
    if (currentUser.role !== 'admin' && !canManagerCreateCounselor) {
      const error = new Error('Only Videshway admin can create manager logins. Partner managers can create their own counselor login.');
      setAppError(error.message);
      throw error;
    }

    if (!isSupabaseConfigured) {
      setAccountRequests((prev) => prev.map((request) => (
        request.id === requestId ? { ...request, status: 'active', note: 'Demo login created.' } : request
      )));
      return { ok: true, ...request };
    }

    const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
    const authSession = session || (sessionResult && sessionResult.session);
    if (sessionError || !authSession || !authSession.access_token) {
      const error = new Error('Your admin session expired. Please sign in again and retry login creation.');
      setAppError(error.message);
      throw error;
    }

    const { data, error } = await supabase.functions.invoke('invite-user', {
      headers: {
        Authorization: 'Bearer ' + authSession.access_token,
      },
      body: { account_request_id: requestId, password },
    });

    if (error) {
      let message = error.message;
      if (error.context?.json) {
        const details = await error.context.json().catch(() => null);
        message = details?.error || message;
      }
      setAppError(message);
      throw new Error(message);
    }

    if (data?.error) {
      setAppError(data.error);
      throw new Error(data.error);
    }

    await refreshData();
    await logAuditEvent('account_requests', requestId, 'login_created', { account_request_id: requestId });
    return data;
  }

  const sendAccountInvite = createAccountLogin;

  async function createStudentInvite(studentId) {
    requireUser(currentUser);
    setAppError('');

    const student = students.find((item) => item.id === studentId);
    if (!student) {
      const error = new Error('Student was not found.');
      setAppError(error.message);
      throw error;
    }

    const token = isSupabaseConfigured ? makeInviteToken() : `demo-${student.id}`;
    const link = studentInviteUrl(student, token);

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('student_invites').insert({
        organization_id: student.organization_id || currentUser.organization_id,
        student_id: student.id,
        created_by: currentUser.id,
        token_hash: await sha256Hex(token),
        status: 'active',
      });

      if (error) {
        setAppError(error.message);
        throw error;
      }
    }

    setActiveInviteStudentId(student.id);
    setActiveInviteUrl(link);
    return { link, token };
  }

  async function addApplication(application) {
    requireUser(currentUser);
    setAppError('');

    const student = students.find((item) => item.id === application.student_id);
    const baseApplication = {
      status: 'documents_pending',
      fee_status: 'not_paid',
      deposit_status: 'not_due',
      manager_id: student?.manager_id || currentUser.id,
      counselor_id: student?.counselor_id || currentUser.id,
      updated_at: new Date().toISOString(),
      ...application,
    };

    if (!isSupabaseConfigured) {
      const nextApplication = {
        id: `app-${Date.now()}`,
        ...baseApplication,
      };
      setApplications((prev) => [nextApplication, ...prev]);
      return nextApplication;
    }

    const payload = {
      organization_id: student?.organization_id || currentUser.organization_id,
      student_id: application.student_id,
      course_id: isUuid(application.course_id) ? application.course_id : null,
      manager_id: baseApplication.manager_id,
      counselor_id: baseApplication.counselor_id,
      university: application.university,
      country: application.country,
      course: application.course,
      intake: application.intake,
      status: 'documents_pending',
      fee_status: 'not_paid',
      deposit_status: 'not_due',
    };

    const { data, error } = await supabase.from('applications').insert(payload).select('*').single();
    if (error) {
      setAppError(error.message);
      throw error;
    }
    setApplications((prev) => [data, ...prev]);
    captureEvent('application_created', { application_id: data.id, student_id: data.student_id }, currentUser);
    refreshDataRef.current().catch(() => {});
    return data;
  }

  async function addCourse(course) {
    requireUser(currentUser);
    setAppError('');

    if (currentUser.role !== 'admin') {
      const error = new Error('Only Videshway admin can add or update the course list.');
      setAppError(error.message);
      throw error;
    }

    if (!isSupabaseConfigured) {
      const nextCourse = normalizeCourseRecord({ ...course, id: `course-${Date.now()}` });
      setCourses((prev) => [nextCourse, ...prev]);
      return nextCourse;
    }

    const payload = coursePayload(course);
    const { data, error } = await supabase.from('courses').insert(payload).select('*').single();
    if (error) {
      setAppError(error.message);
      throw error;
    }
    const mappedCourse = mapCourse(data);
    setCourses((prev) => [mappedCourse, ...prev]);
    return mappedCourse;
  }

  async function searchCourses(filters = {}) {
    if (!isSupabaseConfigured) {
      const query = String(filters.query || '').toLowerCase();
      const rows = courses.filter((course) => {
        if (filters.country && filters.country !== 'All' && course.country !== filters.country) return false;
        if (filters.level && filters.level !== 'All' && course.level !== filters.level) return false;
        if (filters.intake && filters.intake !== 'All' && !String(course.intake || '').includes(filters.intake)) return false;
        if (!query) return true;
        return `${course.university} ${course.course} ${course.subject} ${course.city} ${course.country}`.toLowerCase().includes(query);
      }).slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 100));
      setCourses((current) => (filters.append ? mergeCourseRows(current, rows) : rows));
      return rows;
    }

    const { data, error } = await supabase.rpc('search_courses', {
      filter_country: filters.country || 'All',
      filter_level: filters.level || 'All',
      filter_intake: filters.intake || 'All',
      filter_query: filters.query || '',
      page_limit: filters.limit || 100,
      page_offset: filters.offset || 0,
    });
    if (error) {
      setAppError(error.message);
      throw error;
    }
    const mapped = (data || []).map(mapCourse);
    setCourses((current) => (filters.append ? mergeCourseRows(current, mapped) : mapped));
    setCourseCatalogStatus((current) => ({
      ...current,
      totalLoaded: filters.append ? Math.max(current.totalLoaded || 0, (filters.offset || 0) + mapped.length) : mapped.length,
      totalAvailable: Math.max(current.totalAvailable || 0, mapped.length),
      lastError: '',
    }));
    return mapped;
  }

  async function bulkImportCourses(courseRows, options = {}) {
    requireUser(currentUser);
    setAppError('');

    if (currentUser.role !== 'admin') {
      const error = new Error('Only Videshway admin can import the course catalog.');
      setAppError(error.message);
      throw error;
    }

    const requiredFields = ['country', 'university', 'course', 'level'];
    const summary = {
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    const normalizedRows = [];
    const incomingKeys = new Set();

    courseRows.forEach((row, index) => {
      const normalized = normalizeCourseRecord({
        ...row,
        is_verified: options.markVerified ? true : row.is_verified,
      }, index);
      const missing = requiredFields.filter((field) => !normalized[field]);

      if (missing.length) {
        summary.failed += 1;
        summary.errors.push(`Row ${index + 2}: missing ${missing.join(', ')}`);
        return;
      }

      if (incomingKeys.has(normalized.catalog_key)) {
        summary.skipped += 1;
        summary.errors.push(`Row ${index + 2}: duplicate programme in this import`);
        return;
      }

      incomingKeys.add(normalized.catalog_key);
      normalizedRows.push(normalized);
    });

    if (!normalizedRows.length) return summary;

    if (!isSupabaseConfigured) {
      const byKey = new Map(courses.map((course) => [course.catalog_key || courseIdentityKey(course), course]));
      const next = [...courses];

      normalizedRows.forEach((course) => {
        const key = course.catalog_key;
        const existing = byKey.get(key);

        if (!existing) {
          next.unshift(course);
          byKey.set(key, course);
          summary.created += 1;
          return;
        }

        if (options.updateExisting === false) {
          summary.skipped += 1;
          return;
        }

        const updated = { ...existing, ...course, id: existing.id };
        const rowIndex = next.findIndex((item) => item.id === existing.id);
        if (rowIndex >= 0) next[rowIndex] = updated;
        byKey.set(key, updated);
        summary.updated += 1;
      });

      setCourses(next);
      return summary;
    }

    const existingKeys = new Set();
    for (const keyChunk of chunkRows(normalizedRows.map((course) => course.catalog_key), 250)) {
      const existingResult = await supabase
        .from('courses')
        .select('catalog_key')
        .in('catalog_key', keyChunk);

      if (existingResult.error) {
        setAppError(existingResult.error.message);
        throw existingResult.error;
      }

      (existingResult.data || []).forEach((course) => existingKeys.add(course.catalog_key));
    }

    const rowsToImport = options.updateExisting === false
      ? normalizedRows.filter((course) => !existingKeys.has(course.catalog_key))
      : normalizedRows;
    summary.skipped += normalizedRows.length - rowsToImport.length;
    const payloads = rowsToImport.map(coursePayload);

    for (const chunk of chunkRows(payloads, 250)) {
      const { data, error } = await supabase
        .from('courses')
        .upsert(chunk, { onConflict: 'catalog_key' })
        .select('*');

      if (error) {
        summary.failed += chunk.length;
        summary.errors.push(error.message);
        setAppError(error.message);
        throw error;
      }

      setCourses((current) => {
        const next = [...current];
        const byKey = new Map(next.map((course) => [course.catalog_key || courseIdentityKey(course), course]));

        (data || []).map(mapCourse).forEach((course) => {
          const existing = byKey.get(course.catalog_key);
          if (existing) {
            const rowIndex = next.findIndex((item) => item.id === existing.id);
            if (rowIndex >= 0) next[rowIndex] = course;
          } else {
            next.unshift(course);
          }
          byKey.set(course.catalog_key, course);
        });

        return next;
      });
    }

    summary.created = rowsToImport.filter((course) => !existingKeys.has(course.catalog_key)).length;
    summary.updated = rowsToImport.length - summary.created;
    return summary;
  }

  async function updateApplicationStatus(applicationId, status) {
    requireUser(currentUser);
    setAppError('');

    if (currentUser.role !== 'admin' && !partnerEditableStatuses.has(status)) {
      const error = new Error('Only Videshway admin can move an application into university, offer, visa, or enrollment stages.');
      setAppError(error.message);
      throw error;
    }

    const patch = applicationWorkflowPatch(status);

    if (!isSupabaseConfigured) {
      const application = applications.find((item) => item.id === applicationId);
      setApplications((prev) => prev.map((application) => (
        application.id === applicationId
          ? { ...application, ...patch }
          : application
      )));
      if (application && status === 'deposit_paid' && !commissions.some((commission) => commission.application_id === applicationId)) {
        setCommissions((prev) => [{
          id: `comm-${Date.now()}`,
          organization_id: application.organization_id || currentUser.organization_id,
          application_id: applicationId,
          student_id: application.student_id,
          manager_id: application.manager_id,
          university: application.university,
          course: application.course,
          expected_amount: 0,
          currency: 'INR',
          status: 'projected',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, ...prev]);
      }
      return;
    }

    const { data, error } = await supabase
      .from('applications')
      .update(patch)
      .eq('id', applicationId)
      .select('*')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }
    setApplications((prev) => prev.map((application) => (application.id === applicationId ? data : application)));
    await refreshData();
  }

  async function addApplicationNote(applicationId, body) {
    requireUser(currentUser);
    setAppError('');

    if (!isSupabaseConfigured) {
      const note = {
        id: `note-${Date.now()}`,
        application_id: applicationId,
        author_id: currentUser.id,
        author_name: currentUser.name,
        body,
        created_at: new Date().toISOString(),
      };

      setApplicationNotes((prev) => [note, ...prev]);
      return note;
    }

    const { data, error } = await supabase
      .from('application_events')
      .insert({
        application_id: applicationId,
        actor_id: currentUser.id,
        note: body,
      })
      .select('*, actor:profiles(full_name)')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }

    const note = mapApplicationNote(data);
    setApplicationNotes((prev) => [note, ...prev]);
    return note;
  }

  async function addTask(task) {
    requireUser(currentUser);
    setAppError('');

    const student = students.find((item) => item.id === task.student_id);
    const nextTask = {
      id: `task-${Date.now()}`,
      organization_id: student?.organization_id || currentUser.organization_id,
      assigned_to: task.assigned_to || student?.counselor_id || student?.manager_id || currentUser.id,
      priority: task.priority || 'Medium',
      status: task.status || 'open',
      due_date: task.due_date || task.due || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
      ...task,
    };

    if (!isSupabaseConfigured) {
      const demoTask = { ...nextTask, id: `task-${Date.now()}`, owner: currentUser.name, due: nextTask.due_date };
      setTasks((prev) => [demoTask, ...prev]);
      return demoTask;
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        organization_id: nextTask.organization_id,
        student_id: nextTask.student_id || null,
        application_id: nextTask.application_id || null,
        assigned_to: nextTask.assigned_to,
        title: nextTask.title,
        priority: nextTask.priority,
        due_date: nextTask.due_date,
        status: nextTask.status,
      })
      .select('*')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }

    const mappedTask = mapTask(data, users);
    setTasks((prev) => [mappedTask, ...prev]);
    return mappedTask;
  }

  async function addDocument(document) {
    requireUser(currentUser);
    setAppError('');

    const filename = document.file?.name || document.filename || `${document.type.toLowerCase().replaceAll(' ', '-')}.pdf`;

    if (!isSupabaseConfigured) {
      const nextDocument = {
        id: `doc-${Date.now()}`,
        status: 'uploaded',
        scan_status: 'skipped',
        uploaded_by: currentUser.id,
        size: document.file ? bytesToLabel(document.file.size) : 'Pending scan',
        ...document,
        filename,
      };
      setDocuments((prev) => [nextDocument, ...prev]);
      return nextDocument;
    }

    if (!document.file) {
      const error = new Error('Choose a file before uploading to protected storage.');
      setAppError(error.message);
      throw error;
    }

    const student = students.find((item) => item.id === document.student_id);
    const organizationId = student?.organization_id || currentUser.organization_id;
    const storagePath = `${organizationId}/${document.student_id}/${Date.now()}-${safeFilename(filename)}`;
    const { error: uploadError } = await supabase.storage
      .from(documentBucket)
      .upload(storagePath, document.file, {
        cacheControl: '31536000',
        upsert: false,
        contentType: document.file.type || 'application/octet-stream',
      });

    if (uploadError) {
      setAppError(uploadError.message);
      throw uploadError;
    }

    const payload = {
      organization_id: organizationId,
      student_id: document.student_id,
      application_id: document.application_id || null,
      uploaded_by: currentUser.id,
      document_type: document.type,
      original_filename: filename,
      storage_bucket: documentBucket,
      storage_path: storagePath,
      content_type: document.file.type || 'application/octet-stream',
      file_size: document.file.size,
      status: 'uploaded',
      scan_status: 'skipped',
    };

    const { data, error } = await supabase.from('documents').insert(payload).select('*').single();
    if (error) {
      await supabase.storage.from(documentBucket).remove([storagePath]);
      setAppError(error.message);
      throw error;
    }

    const mappedDocument = mapDocument(data);
    setDocuments((prev) => [mappedDocument, ...prev]);
    captureEvent('document_uploaded', { document_id: data.id, student_id: data.student_id }, currentUser);
    refreshDocumentsRef.current().catch(() => {});
    return mappedDocument;
  }

  async function updateDocumentStatus(documentId, status, note = '') {
    requireUser(currentUser);
    setAppError('');

    if (currentUser.role !== 'admin') {
      const error = new Error('Only Videshway admin can approve or reject uploaded documents.');
      setAppError(error.message);
      throw error;
    }

    const currentDocument = documents.find((document) => document.id === documentId);
    if (status === 'approved' && (currentDocument?.scan_status || 'skipped') === 'pending') {
      const error = new Error('Document scan must finish before approval.');
      setAppError(error.message);
      throw error;
    }

    if (!isSupabaseConfigured) {
      setDocuments((prev) => prev.map((document) => (
        document.id === documentId ? {
          ...document,
          status,
          note,
          reviewed_by: currentUser.id,
          reviewed_at: new Date().toISOString(),
        } : document
      )));
      return;
    }

    const { data, error } = await supabase
      .from('documents')
      .update({
        status,
        rejection_reason: note || null,
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', documentId)
      .select('*')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }

    const mappedDocument = mapDocument(data);
    setDocuments((prev) => prev.map((document) => (document.id === documentId ? mappedDocument : document)));
    captureEvent('document_status_changed', { document_id: documentId, status }, currentUser);
  }

  async function getDocumentDownloadUrl(documentId) {
    requireUser(currentUser);
    setAppError('');

    const document = documents.find((item) => item.id === documentId);
    if (!document) {
      const error = new Error('Document was not found.');
      setAppError(error.message);
      throw error;
    }

    if (!visibleDocuments.some((item) => item.id === documentId)) {
      const error = new Error('You do not have access to this document.');
      setAppError(error.message);
      throw error;
    }

    if (!isSupabaseConfigured) {
      const blob = document.file instanceof Blob
        ? document.file
        : new Blob([
          `Bizzlo document export\n\nType: ${document.type}\nFilename: ${document.filename}\nStatus: ${document.status}\nNote: ${document.note || '-'}\n`,
        ], { type: 'text/plain' });
      return {
        url: URL.createObjectURL(blob),
        filename: document.filename || `${document.type || 'document'}.txt`,
        revoke: true,
      };
    }

    if (!document.storage_path) {
      const error = new Error('This document does not have a storage path.');
      setAppError(error.message);
      throw error;
    }

    const { data, error } = await supabase.storage
      .from(document.storage_bucket || documentBucket)
      .createSignedUrl(document.storage_path, 120, {
        download: document.filename || document.original_filename || 'student-document',
      });

    if (error) {
      setAppError(error.message);
      throw error;
    }

    logAuditEvent('documents', documentId, 'document_downloaded', {
      filename: document.filename || document.original_filename || 'student-document',
    }).catch(() => {});

    return {
      url: data.signedUrl,
      filename: document.filename || document.original_filename || 'student-document',
      revoke: false,
    };
  }

  async function updateCommission(commissionId, patch) {
    requireUser(currentUser);
    setAppError('');

    if (!isSupabaseConfigured) {
      setCommissions((prev) => prev.map((commission) => (
        commission.id === commissionId ? { ...commission, ...patch } : commission
      )));
      return;
    }

    const { data, error } = await supabase
      .from('commissions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', commissionId)
      .select('*, application:applications(student_id, university, course)')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }
    const mappedCommission = mapCommission(data);
    setCommissions((prev) => prev.map((commission) => (commission.id === commissionId ? mappedCommission : commission)));
    captureEvent('commission_status_changed', { commission_id: commissionId, status: patch.status }, currentUser);
  }

  async function updatePartnerFinanceProfile(profile) {
    requireUser(currentUser);
    setAppError('');

    if (!['admin', 'manager'].includes(currentUser.role)) {
      const error = new Error('Only partner managers and Videshway admin can update finance details.');
      setAppError(error.message);
      throw error;
    }

    const organizationId = profile.organization_id || currentUser.organization_id;
    const organization = organizations.find((item) => item.id === organizationId);
    const manager = users.find((user) => (
      user.role === 'manager'
      && (user.organization_id === organizationId || user.id === organization?.primary_manager_id)
    ));
    const status = currentUser.role === 'admin' && profile.status
      ? profile.status
      : 'pending_admin_review';
    const payload = {
      organization_id: organizationId,
      manager_id: profile.manager_id || manager?.id || (currentUser.role === 'manager' ? currentUser.id : null),
      legal_name: profile.legal_name,
      account_holder: profile.account_holder,
      bank_name: profile.bank_name,
      account_number: profile.account_number,
      ifsc: profile.ifsc,
      swift_code: profile.swift_code || '',
      payout_currency: profile.payout_currency || 'INR',
      gst_registered: Boolean(profile.gst_registered),
      gstin: profile.gstin || '',
      pan: profile.pan || '',
      billing_address: profile.billing_address || '',
      status,
      notes: profile.notes || '',
      updated_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      const nextProfile = {
        id: profile.id || `fin-${organizationId}`,
        ...payload,
      };
      setPartnerFinanceProfiles((prev) => {
        const existingIndex = prev.findIndex((item) => item.organization_id === organizationId);
        if (existingIndex === -1) return [nextProfile, ...prev];
        return prev.map((item, index) => (index === existingIndex ? { ...item, ...nextProfile } : item));
      });
      return nextProfile;
    }

    const { data, error } = await supabase
      .from('partner_finance_profiles')
      .upsert(payload, { onConflict: 'organization_id' })
      .select('*')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }

    setPartnerFinanceProfiles((prev) => {
      const existingIndex = prev.findIndex((item) => item.organization_id === data.organization_id);
      if (existingIndex === -1) return [data, ...prev];
      return prev.map((item, index) => (index === existingIndex ? data : item));
    });
    return data;
  }

  async function closeTask(taskId) {
    requireUser(currentUser);
    setAppError('');

    if (!isSupabaseConfigured) {
      setTasks((prev) => prev.map((task) => (
        task.id === taskId ? { ...task, status: 'done' } : task
      )));
      return;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }
    setTasks((prev) => prev.map((task) => (task.id === taskId ? mapTask(data, users) : task)));
  }

  async function addServiceRequest(service) {
    requireUser(currentUser);
    setAppError('');

    const request = {
      id: `service-${Date.now()}`,
      title: service.title,
      category: service.category || service.status || '360 Solutions',
      status: 'requested',
      requested_by: currentUser.id,
      requester_name: currentUser.name,
      organization_id: currentUser.organization_id,
      created_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      setServiceRequests((prev) => [request, ...prev]);
      return request;
    }

    const { data, error } = await supabase
      .from('service_requests')
      .insert({
        organization_id: currentUser.organization_id,
        requested_by: currentUser.id,
        title: request.title,
        category: request.category,
        status: 'requested',
      })
      .select('*, requester:profiles(full_name)')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }

    const mappedRequest = mapServiceRequest(data);
    setServiceRequests((prev) => [mappedRequest, ...prev]);
    return mappedRequest;
  }

  async function toggleTrainingModule(title) {
    requireUser(currentUser);
    setAppError('');

    if (!isSupabaseConfigured) {
      setCompletedTrainingModules((current) => (
        current.includes(title)
          ? current.filter((item) => item !== title)
          : [title, ...current]
      ));
      return;
    }

    if (completedTrainingModules.includes(title)) {
      const { error } = await supabase
        .from('training_progress')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('module_title', title);

      if (error) {
        setAppError(error.message);
        throw error;
      }
      setCompletedTrainingModules((current) => current.filter((item) => item !== title));
      return;
    }

    const { error } = await supabase
      .from('training_progress')
      .upsert({
        user_id: currentUser.id,
        organization_id: currentUser.organization_id,
        module_title: title,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,module_title' });

    if (error) {
      setAppError(error.message);
      throw error;
    }

    setCompletedTrainingModules((current) => [title, ...current]);
  }

  async function addSupportTicket(ticket) {
    requireUser(currentUser);
    setAppError('');

    const nextTicket = {
      id: `ticket-${Date.now()}`,
      ...ticket,
      status: 'requested',
      created_by: currentUser.id,
      organization_id: currentUser.organization_id,
      requester_name: currentUser.name,
      created_at: new Date().toISOString(),
    };

    if (!isSupabaseConfigured) {
      setSupportTickets((prev) => [nextTicket, ...prev]);
      return nextTicket;
    }

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        organization_id: currentUser.organization_id,
        student_id: ticket.student_id || null,
        application_id: ticket.application_id || null,
        created_by: currentUser.id,
        type: ticket.type,
        title: ticket.title,
        message: ticket.message,
        status: 'requested',
      })
      .select('*, creator:profiles(full_name)')
      .single();

    if (error) {
      setAppError(error.message);
      throw error;
    }

    const mappedTicket = mapSupportTicket(data);
    setSupportTickets((prev) => [mappedTicket, ...prev]);
    return mappedTicket;
  }

  const sortedStudents = useMemo(() => sortNewest(students), [students]);
  const sortedVisibleStudents = useMemo(() => sortNewest(visibleStudents), [visibleStudents]);
  const sortedApplications = useMemo(() => sortNewest(applications), [applications]);
  const sortedVisibleApplications = useMemo(() => sortNewest(visibleApplications), [visibleApplications]);

  const value = useMemo(() => ({
    isDemoMode,
    isProductionMisconfigured,
    isSupabaseConfigured,
    session,
    authLoading,
    dataLoading,
    appError,
    clearError: () => setAppError(''),
    signIn,
    signOut,
    resetPassword,
    refreshData,
    currentUser,
    setCurrentUser,
    users,
    organizations,
    visibleOrganizations,
    accountRequests: visibleAccountRequests,
    managers,
    counselors,
    managerCounselors,
    students: sortedStudents,
    visibleStudents: sortedVisibleStudents,
    applications: sortedApplications,
    visibleApplications: sortedVisibleApplications,
    applicationNotes,
    visibleApplicationNotes,
    documents: visibleDocuments,
    visibleDocuments,
    courses,
    courseCatalogStatus,
    catalogLoadingCountry,
    tasks,
    visibleTasks,
    commissions,
    visibleCommissions,
    partnerFinanceProfiles,
    visiblePartnerFinanceProfiles,
    serviceRequests,
    supportTickets,
    auditEvents,
    studentInvites,
    completedTrainingModules,
    activeInviteStudentId,
    activeInviteUrl,
    setActiveInviteStudentId,
    setActiveInviteUrl,
    partnerEditableStatuses,
    addPartnerAccount,
    requestCounselorAccount,
    updateAccountRequest,
    updatePartnerSeatLimit,
    createAccountLogin,
    sendAccountInvite,
    createStudentInvite,
    addStudent,
    addApplication,
    addApplicationNote,
    addTask,
    addCourse,
    bulkImportCourses,
    searchCourses,
    loadCatalogCountry,
    loadCourseCatalogCount,
    loadFullCourseCatalog,
    refreshDocuments: loadDocuments,
    updateApplicationStatus,
    addDocument,
    updateDocumentStatus,
    getDocumentDownloadUrl,
    updateCommission,
    updatePartnerFinanceProfile,
    closeTask,
    addServiceRequest,
    toggleTrainingModule,
    addSupportTicket,
  // Action functions are intentionally omitted; they are stable enough for consumers
  // because every state-changing action refreshes or updates local state directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    activeInviteStudentId,
    activeInviteUrl,
    appError,
    applicationNotes,
    auditEvents,
    authLoading,
    catalogLoadingCountry,
    completedTrainingModules,
    counselors,
    commissions,
    courseCatalogStatus,
    courses,
    currentUser,
    dataLoading,
    documents,
    isDemoMode,
    isProductionMisconfigured,
    managerCounselors,
    managers,
    organizations,
    partnerFinanceProfiles,
    serviceRequests,
    session,
    studentInvites,
    sortedApplications,
    sortedStudents,
    sortedVisibleApplications,
    sortedVisibleStudents,
    supportTickets,
    tasks,
    users,
    visibleAccountRequests,
    visibleApplicationNotes,
    visibleCommissions,
    visibleDocuments,
    visibleOrganizations,
    visiblePartnerFinanceProfiles,
    visibleTasks,
  ]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used inside AppStateProvider');
  }
  return context;
}
