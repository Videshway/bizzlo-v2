import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('launch menu keeps support and removes old sections', async () => {
  const source = await read('../../src/components/Shell.jsx')
  assert.ok(source.includes("label: 'Support'"))
  assert.ok(!source.includes("label: '360 Solutions'"))
  assert.ok(!source.includes("label: 'Tasks'"))
  assert.ok(!source.includes("label: 'Intake'"))
})

test('alerts use admin and partner workflow signals', async () => {
  const source = await read('../../src/components/Shell.jsx')
  assert.ok(source.includes('Partner sent documents for admin decision'))
  assert.ok(source.includes('Admin requested changes'))
  assert.ok(source.includes('Admin update:'))
  assert.ok(source.includes('Document waiting for admin approval'))
  assert.ok(source.includes('Admin rejected this document'))
})

test('dashboard no longer advertises hidden resources', async () => {
  const source = await read('../../src/pages/Dashboard.jsx')
  assert.ok(source.includes("action.id !== 'resources'"))
  assert.ok(source.includes('Open students'))
  assert.ok(!source.includes('Start intake'))
})

test('partners hand uploaded documents to admin', async () => {
  const source = await read('../../src/pages/Applications.jsx')
  assert.ok(source.includes('Send to admin'))
  assert.ok(source.includes('partnerSubmitStatuses'))
  assert.ok(source.includes('hasSubmittedDocuments'))
  assert.ok(source.includes('ready_for_admin_review'))
  assert.ok(source.includes('Videshway admin controls the next movement'))
})

test('app state blocks partner jumps after admin owns a file', async () => {
  const source = await read('../../src/lib/appState.jsx')
  assert.ok(source.includes('This file is already with Videshway admin'))
  assert.ok(source.includes('Upload at least one student document before sending'))
  assert.ok(source.includes('Partner submitted uploaded documents for Videshway admin review'))
  assert.ok(source.includes('Videshway admin updated this application to'))
})

test('database policy locks the partner handoff statuses', async () => {
  const source = await read('../../supabase/migrations/013_partner_status_handoff.sql')
  assert.ok(source.includes('applications update through student'))
  assert.ok(source.includes('ready_for_admin_review'))
  assert.ok(!source.includes('pending_admin_review'))
  assert.ok(!source.includes('submitted_to_university'))
})
