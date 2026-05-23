export const intakeOptions = ['September', 'January', 'May'];

export const studyLevelOptions = ['Undergraduate', 'Postgraduate', 'Masters', 'PhD', 'Diploma'];

export const countryOptions = [
  'United Kingdom',
  'Ireland',
  'United States',
  'Germany',
  'Australia',
  'New Zealand',
  'Dubai',
  'Canada',
];

export const nationalityOptions = [
  'India',
  'Nepal',
  'Bangladesh',
  'Sri Lanka',
  'Pakistan',
  'United Arab Emirates',
  'Other',
];

export const disciplineOptions = [
  'Business & Management',
  'Computer Science & IT',
  'Data Science & AI',
  'Engineering',
  'Health Sciences',
  'Hospitality & Tourism',
  'Law',
  'Finance & Accounting',
  'Media & Communication',
  'Architecture & Design',
];

export function phoneDigits(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

export function normalizePhoneInput(nationality, value) {
  const raw = String(value || '');
  if (nationality === 'India') return phoneDigits(raw);
  return raw
    .replace(/[^\d+]/g, '')
    .replace(/(?!^)\+/g, '')
    .slice(0, 16);
}

export function validatePhone(nationality, value) {
  const phone = String(value || '').trim();
  if (nationality === 'India') return /^[0-9]{10}$/.test(phone);
  return /^\+?[0-9]{8,15}$/.test(phone);
}
