import {
  BookOpenCheck,
  BookOpenText,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileBadge2,
  FileText,
  GraduationCap,
  Home,
  Languages,
  Plane,
  Presentation,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';

export const applicationStages = [
  'profile_incomplete',
  'documents_pending',
  'ready_for_admin_review',
  'pending_admin_review',
  'submitted_to_university',
  'offer_received',
  'deposit_paid',
  'cas_issued',
  'visa_filed',
  'visa_granted',
  'enrolled',
];

export const applicationStageAliases = {
  awaiting_decision: 'submitted_to_university',
  conditional_offer: 'offer_received',
  unconditional_offer: 'offer_received',
  offer_rejected: 'offer_received',
  rejected: 'submitted_to_university',
};

export const requiredDocuments = [
  'Passport',
  'Academic Transcript',
  'Degree Certificate',
  'IELTS',
  'SOP',
  'LOR',
  'CV',
  'Bank Statement',
];

export const referenceActions = [
  { id: 'courses', label: 'Program Search', detail: 'Find eligible courses and compare up to 24 options.', icon: GraduationCap },
  { id: 'students', label: 'Invite Students', detail: 'Create a student file and share a self-service document link.', icon: UsersRound },
  { id: 'applications', label: 'Applications', detail: 'Track every requirement, note, fee, and university decision.', icon: FileBadge2 },
  { id: 'commissions', label: 'Finance', detail: 'Save payout details and follow projected, invoiced, and paid partner commission.', icon: CircleDollarSign },
  { id: 'resources', label: '360 Solutions', detail: 'Add services such as tests, SOP, visa, housing, and banking.', icon: Sparkles },
  { id: 'resources', label: 'TrainHub', detail: 'Country guides, partner playbooks, and counselor enablement.', icon: BookOpenCheck },
];

export const partnerServices = [
  { title: 'University Shortlist Review', text: 'Destination, budget, eligibility, and deadline validation before applications.', icon: GraduationCap, status: 'Available' },
  { title: 'SOP, LOR & Resume Studio', text: 'Drafting checklist, sample structure, document review, and final polish.', icon: FileBadge2, status: 'Available' },
  { title: 'Visa & CAS/I-20 Guidance', text: 'Visa file checklist, interview prep, CAS/I-20 follow-up, and finance proof review.', icon: Plane, status: 'Admin routed' },
  { title: 'Accommodation & Arrival', text: 'Housing, airport pickup, insurance, and pre-departure service request tracking.', icon: Home, status: 'Partner service' },
  { title: 'Education Loan / GIC / Forex', text: 'Funding document collection, lender handoff, GIC, and payment support.', icon: Building2, status: 'Partner service' },
  { title: 'English Test Prep', text: 'IELTS, PTE, TOEFL, and Duolingo readiness support with score tracking.', icon: Languages, status: 'Available' },
];

export const trainingModules = [
  { title: 'UK, Ireland & Germany Desk', meta: '22 min · intakes, documents, CAS, APS, and visa notes' },
  { title: 'US File Review', meta: '18 min · GPA, scores, funding, I-20, and deposit timing' },
  { title: 'Australia & New Zealand', meta: '21 min · provider codes, Genuine Student, COE, and visa readiness' },
  { title: 'Dubai & Pathway Programs', meta: '12 min · branch campuses, transfer routes, and fee checkpoints' },
  { title: 'Partner Commission Rules', meta: '14 min · projected, invoice, paid, and clawback controls' },
];

export const resourceLibrary = [
  {
    title: 'Partner Operating Playbook',
    type: 'PPT',
    category: 'Partner onboarding',
    summary: 'Daily workflow for managers and counselors: student intake, shortlist, documents, admin review, and commission visibility.',
    icon: Presentation,
    filename: 'bizzlo-partner-operating-playbook.ppt',
    file_url: '/resources/bizzlo-partner-operating-playbook.ppt',
  },
  {
    title: 'Country Desk Guide Pack',
    type: 'PDF',
    category: 'Destination guide',
    summary: 'UK, Ireland, US, Germany, Australia, New Zealand, and Dubai intake/document notes for quick counseling.',
    icon: BookOpenText,
    filename: 'bizzlo-country-desk-guide.pdf',
    file_url: '/resources/bizzlo-country-desk-guide.pdf',
  },
  {
    title: 'Document Quality Checklist',
    type: 'DOC',
    category: 'Document SOP',
    summary: 'Passport, transcripts, SOP, LOR, CV, IELTS/PTE, bank statement, and visa document acceptance checks.',
    icon: ClipboardCheck,
    filename: 'bizzlo-document-quality-checklist.doc',
    file_url: '/resources/bizzlo-document-quality-checklist.doc',
  },
  {
    title: 'SOP & LOR Template Bank',
    type: 'DOC',
    category: 'Application support',
    summary: 'Editable structure for statement drafts, recommender notes, resume alignment, and university-specific edits.',
    icon: FileText,
    filename: 'bizzlo-sop-lor-template-bank.doc',
    file_url: '/resources/bizzlo-sop-lor-template-bank.doc',
  },
  {
    title: 'Visa Readiness Deck',
    type: 'PPT',
    category: 'Visa support',
    summary: 'CAS/I-20/COE readiness, finance proof, interview preparation, and refusal-risk checks.',
    icon: Presentation,
    filename: 'bizzlo-visa-readiness-deck.ppt',
    file_url: '/resources/bizzlo-visa-readiness-deck.ppt',
  },
  {
    title: 'Commission & Payments SOP',
    type: 'PDF',
    category: 'Finance',
    summary: 'Manager-facing guide for projected commissions, invoices, deposits, payment proof, and settlement stages.',
    icon: CircleDollarSign,
    filename: 'bizzlo-commission-payments-sop.pdf',
    file_url: '/resources/bizzlo-commission-payments-sop.pdf',
  },
  {
    title: 'Pre-Departure Support Pack',
    type: 'PPT',
    category: '360 support',
    summary: 'Accommodation, forex, insurance, airport pickup, packing list, enrollment steps, and arrival checklist.',
    icon: Home,
    filename: 'bizzlo-pre-departure-support-pack.ppt',
    file_url: '/resources/bizzlo-pre-departure-support-pack.ppt',
  },
  {
    title: 'Counselor Call Scripts',
    type: 'DOC',
    category: 'Counselor enablement',
    summary: 'Lead qualification, shortlist presentation, document chasing, offer follow-up, and deposit call scripts.',
    icon: UsersRound,
    filename: 'bizzlo-counselor-call-scripts.doc',
    file_url: '/resources/bizzlo-counselor-call-scripts.doc',
  },
];

export const resourceCountries = [
  { id: 'australia', code: 'AUS', name: 'Australia' },
  { id: 'canada', code: 'CAN', name: 'Canada' },
  { id: 'uae', code: 'UAE', name: 'United Arab Emirates' },
  { id: 'germany', code: 'DEU', name: 'Germany' },
  { id: 'ireland', code: 'IRL', name: 'Ireland' },
  { id: 'new-zealand', code: 'NZL', name: 'New Zealand' },
  { id: 'singapore', code: 'SGP', name: 'Singapore' },
  { id: 'united-kingdom', code: 'UK', name: 'United Kingdom' },
  { id: 'united-states', code: 'USA', name: 'United States' },
  { id: 'dubai', code: 'DXB', name: 'Dubai' },
];

export const resourceCategories = [
  'General Presentations',
  'Enquiry Form',
  'Financial Documents',
  'Visa Documents',
  'NOOSR',
  'Application Forms',
  'Application Guide & Method',
  'GS Forms',
  'Samples & Formats',
  'Key Webinar Links',
  'Latest Updates',
];

const resourceSizeByCategory = {
  'General Presentations': '5.38 MB',
  'Enquiry Form': '0.24 MB',
  'Financial Documents': '2.10 MB',
  'Visa Documents': '1.84 MB',
  NOOSR: '0.48 MB',
  'Application Forms': '0.72 MB',
  'Application Guide & Method': '3.55 MB',
  'GS Forms': '0.62 MB',
  'Samples & Formats': '1.16 MB',
  'Key Webinar Links': '0.08 MB',
  'Latest Updates': '0.34 MB',
};

function resourceFilename(country, category, type) {
  const extension = type === 'PPT' ? 'ppt' : 'pdf';
  return `bizzlo-${country.toLowerCase().replaceAll(' ', '-')}-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${extension}`;
}

export const resourceDocuments = resourceCountries.flatMap((country, countryIndex) => (
  resourceCategories.map((category, categoryIndex) => {
    const type = ['General Presentations', 'Application Guide & Method', 'Latest Updates'].includes(category) ? 'PPT' : 'PDF';
    return {
      id: `${country.id}-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      country: country.name,
      countryId: country.id,
      category,
      title: category === 'General Presentations'
        ? `${country.name} General Presentation (India)`
        : `${country.name} - ${category}`,
      date: categoryIndex < 4 ? '18-02-2026' : '04-12-2025',
      size: resourceSizeByCategory[category] || '0.50 MB',
      type,
      filename: resourceFilename(country.name, category, type),
      summary: `${country.name} ${category.toLowerCase()} resource for partner counseling, document collection, and application readiness.`,
      market: countryIndex % 2 === 0 ? 'India' : 'Global',
    };
  })
));

export const complianceChecks = [
  'Private file bucket',
  'Partner/counselor visibility',
  'Admin-only university submission',
  'Document approval trail',
  'Commission finance control',
];

export const paymentMilestones = [
  { label: 'Projected', status: 'projected', description: 'Application is likely commission-bearing.' },
  { label: 'Ready to invoice', status: 'ready_to_invoice', description: 'Offer/deposit condition reached.' },
  { label: 'Invoiced', status: 'invoiced', description: 'Finance has raised partner invoice.' },
  { label: 'Paid', status: 'paid', description: 'Commission released to partner.' },
];

export const courseFilterHints = [
  'Country',
  'Study level',
  'Subject',
  'University',
  'Student fit',
  'PDF listing',
  'Intake',
  'Mode',
  'Budget',
  'Deadline',
];
