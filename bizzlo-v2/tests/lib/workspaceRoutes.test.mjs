import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkspaceRoute, resolveWorkspaceRoute } from '../../src/lib/workspaceRoutes.js';

const origin = 'https://bizzlo.example';

test('student and application links preserve exact selections through URL parsing', () => {
  for (const [page, option, value] of [['students', 'studentId', 'student/a & b'], ['applications', 'applicationId', 'application#1']]) {
    const navigation = buildWorkspaceRoute(page, { [option]: value, query: 'München & design' }, origin);
    const url = new URL(navigation.path, origin);
    assert.equal(url.searchParams.get(option), value);
    assert.equal(url.searchParams.get('q'), 'München & design');
    assert.deepEqual(resolveWorkspaceRoute(url.pathname, url.search), navigation);
  }
});

test('switching application selections creates distinct restorable route keys', () => {
  const first = buildWorkspaceRoute('applications', { applicationId: 'app-one' }, origin);
  const second = buildWorkspaceRoute('applications', { applicationId: 'app-two' }, origin);
  assert.notEqual(first.page + first.search, second.page + second.search);
  const restored = new URL(first.path, origin);
  assert.deepEqual(resolveWorkspaceRoute(restored.pathname, restored.search), first);
});

test('plain navigation clears record filters and Tasks has a reloadable URL', () => {
  assert.deepEqual(buildWorkspaceRoute('students', {}, origin), { page: 'students', path: '/students', search: '' });
  assert.deepEqual(resolveWorkspaceRoute('/tasks/'), { page: 'tasks', path: '/tasks', search: '' });
});

test('legacy dashboard aliases preserve query parameters', () => {
  assert.deepEqual(resolveWorkspaceRoute('/dashboard/', '?q=welcome'), { page: 'dashboard', path: '/?q=welcome', search: '?q=welcome' });
});

test('invite normalization preserves tokens and decodes the invite exactly once', () => {
  const route = resolveWorkspaceRoute('/invite/student%25code/', '?token=a%2Bb');
  assert.equal(route.page, 'studentPortal');
  const params = new URLSearchParams(route.search);
  assert.equal(params.get('invite'), 'student%code');
  assert.equal(params.get('token'), 'a+b');
  const url = new URL(route.path, origin);
  assert.deepEqual(resolveWorkspaceRoute(url.pathname, url.search), route);
});

test('invalid encoded invitations and unknown routes resolve without crashing', () => {
  assert.equal(resolveWorkspaceRoute('/invite/%bad').page, 'notFound');
  assert.equal(resolveWorkspaceRoute('/missing').page, 'notFound');
  assert.equal(buildWorkspaceRoute('missing', {}, origin).page, 'notFound');
});

test('explicit in-app invite paths retain query data and determine the rendered page', () => {
  const route = buildWorkspaceRoute('students', { path: '/student-link?invite=ABC&token=secret' }, origin);
  assert.equal(route.page, 'studentPortal');
  assert.equal(new URLSearchParams(route.search).get('token'), 'secret');
});

test('workspace navigation rejects destinations outside the app', () => {
  assert.throws(() => buildWorkspaceRoute('students', { path: 'https://another.example/students' }, origin), /within this app/);
});
