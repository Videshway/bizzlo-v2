import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../../src/pages/Applications.jsx', import.meta.url), 'utf8');

// Execute the actual pure page helpers without mounting React or calling a backend.
function pageHelper(name, dependencies = {}) {
  const declaration = source.match(new RegExp(`function ${name}\\([\\s\\S]+?\\n\\}`))?.[0];
  assert.ok(declaration, `${name} is defined`);
  return vm.runInNewContext(`${declaration}; ${name}`, dependencies);
}

test('CSV exports neutralize spreadsheet formulas and preserve quoted student data', () => {
  const csvCell = pageHelper('csvCell');
  for (const value of ['=1+1', '+SUM(A1:A2)', '-1+1', '@SUM(A1)', '  =1+1', '\t=1+1', '\r=1+1']) {
    assert.ok(csvCell(value).startsWith('"\''), `formula escaped: ${JSON.stringify(value)}`);
  }
  assert.equal(csvCell('Asha "AJ", Patel'), '"Asha ""AJ"", Patel"');
  assert.equal(csvCell('Université\nParis'), '"Université\nParis"');
  assert.equal(csvCell(null), '""');
});

test('student matching rejects duplicate names and resolves explicit student identities', () => {
  const studentOptionLabel = pageHelper('studentOptionLabel');
  const findStudentFromInput = pageHelper('findStudentFromInput', { studentOptionLabel });
  const students = [
    { id: '1', first_name: 'Asha', last_name: 'Patel', email: 'asha.one@example.test', student_code: 'STU-001' },
    { id: '2', first_name: 'Asha', last_name: 'Patel', email: 'asha.two@example.test', student_code: 'STU-002' },
    { id: '3', first_name: 'Ravi', last_name: 'Shah', email: 'ravi@example.test', student_code: 'STU-003' },
  ];
  assert.equal(findStudentFromInput('Asha Patel', students), null);
  assert.equal(findStudentFromInput('  STU-002  ', students)?.id, '2');
  assert.equal(findStudentFromInput('ASHA.ONE@EXAMPLE.TEST', students)?.id, '1');
  assert.equal(findStudentFromInput(studentOptionLabel(students[1]), students)?.id, '2');
  assert.equal(findStudentFromInput('ravi shah', students)?.id, '3');
  assert.equal(findStudentFromInput('', students), null);
});

test('application dates and intake years never fabricate missing record data', () => {
  const applicationUpdatedDate = pageHelper('applicationUpdatedDate');
  const applicationYear = pageHelper('applicationYear');
  assert.equal(applicationUpdatedDate({}), null);
  assert.equal(applicationUpdatedDate({ updated_at: 'not-a-date' }), null);
  assert.equal(applicationUpdatedDate({ created_at: '2026-10-07T12:00:00Z' }).toISOString(), '2026-10-07T12:00:00.000Z');
  assert.equal(applicationYear({ intake: 'January 2027', updated_at: '2026-10-07' }), '2027');
  assert.equal(applicationYear({ intake: 'September', updated_at: '2026-10-07' }), '');
});

test('updated date filters use the same local calendar as displayed application dates', () => {
  const applicationUpdatedDate = pageHelper('applicationUpdatedDate');
  const matchesUpdatedDate = pageHelper('matchesUpdatedDate', { applicationUpdatedDate });
  const localMidnight = new Date(2026, 9, 7, 0, 15);
  const localLateNight = new Date(2026, 9, 7, 23, 45);
  assert.equal(matchesUpdatedDate({ updated_at: localMidnight.toISOString() }, '2026-10-07'), true);
  assert.equal(matchesUpdatedDate({ updated_at: localLateNight.toISOString() }, '2026-10-07'), true);
  assert.equal(matchesUpdatedDate({ updated_at: localMidnight.toISOString() }, '2026-10-06'), false);
  assert.equal(matchesUpdatedDate({}, '2026-10-07'), false);
  assert.equal(matchesUpdatedDate({}, ''), true);
});

test('unavailable direct application links never silently select an unrelated file', () => {
  const selectVisibleApplication = pageHelper('selectVisibleApplication');
  const applications = [{ id: 'app-1' }, { id: 'app-2' }];
  assert.equal(selectVisibleApplication(applications, applications, 'missing'), undefined);
  assert.equal(selectVisibleApplication(applications, applications, 'app-2'), applications[1]);
  assert.equal(selectVisibleApplication([applications[1]], applications, 'app-1'), applications[1], 'filters can select another visible record');
  assert.equal(selectVisibleApplication(applications, applications, ''), applications[0]);
});

test('readiness uses the latest application document before a general student document', () => {
  const documentForType = pageHelper('documentForType');
  const documents = [
    { id: 'generic', type: 'Passport', status: 'approved', created_at: '2026-10-07' },
    { id: 'old', type: 'Passport', application_id: 'app-1', status: 'approved', created_at: '2026-10-01' },
    { id: 'current', type: 'Passport', application_id: 'app-1', status: 'rejected', created_at: '2026-10-05' },
  ];
  assert.equal(documentForType(documents, 'Passport')?.id, 'current');
  assert.equal(documentForType(documents, 'Transcript'), undefined);
  assert.equal(documents[0].id, 'generic', 'document input order is unchanged');
});
