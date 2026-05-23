import { useEffect, useMemo, useState } from 'react';
import { Building2, Download, Landmark, Pencil, PlayCircle, Save, Search, ShieldCheck } from 'lucide-react';
import {
  alliedServiceRows,
  commissionImportColumns,
  commissionStructureRows,
  loadCommissionRules,
} from '../data/commissionRules';
import { applicationStageAliases, paymentMilestones } from '../data/referenceWorkflow';
import { useAppState } from '../lib/appState';
import { labelFor, money } from '../lib/status';
import { Badge, EmptyState, Modal, Panel, SelectInput, StatusBadge, TextInput } from '../components/ui';

function csv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadRows(filename, header, rows) {
  const body = rows.map((row) => header.map((key) => csv(row[key])).join(','));
  const blob = new Blob([[header.map(csv).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

const blankFinanceProfile = {
  legal_name: '',
  account_holder: '',
  bank_name: '',
  account_number: '',
  ifsc: '',
  swift_code: '',
  payout_currency: 'INR',
  gst_registered: true,
  gstin: '',
  pan: '',
  billing_address: '',
  notes: '',
};

const trackerStages = ['submitted_to_university', 'offer_received', 'deposit_paid', 'cas_issued', 'visa_filed', 'visa_granted', 'enrolled'];

function financeFormFromProfile(profile) {
  return {
    ...blankFinanceProfile,
    ...(profile || {}),
    gst_registered: profile?.gst_registered ?? true,
  };
}

function partnerApplicationsFor(organization, manager, applications) {
  return applications.filter((application) => (
    application.organization_id === organization.id
    || (manager?.id && application.manager_id === manager.id)
  ));
}

function countByStatus(applications, status) {
  return applications.filter((application) => (
    !['offer_rejected', 'rejected'].includes(application.status)
    && (applicationStageAliases[application.status] || application.status) === status
  )).length;
}

function ManagerFinanceProfile({ currentFinanceProfile, currentUser, updatePartnerFinanceProfile }) {
  const [financeForm, setFinanceForm] = useState(() => financeFormFromProfile(currentFinanceProfile));
  const [financeSaving, setFinanceSaving] = useState(false);

  async function handleFinanceSubmit(event) {
    event.preventDefault();
    setFinanceSaving(true);
    try {
      await updatePartnerFinanceProfile({
        ...financeForm,
        id: currentFinanceProfile?.id,
        organization_id: currentUser.organization_id,
        manager_id: currentUser.id,
      });
    } finally {
      setFinanceSaving(false);
    }
  }

  return (
    <Panel title="Partner Finance Account" description="Add payout, GST, PAN, and billing details. Videshway admin verifies this before partner payouts are released.">
      <div className="finance-profile-layout">
        <section className="profile-summary-card">
          <ShieldCheck size={20} />
          <strong>{currentFinanceProfile?.legal_name || 'Finance profile not submitted'}</strong>
          <StatusBadge value={currentFinanceProfile?.status || 'pending_admin_review'} />
          <span>GST: {currentFinanceProfile?.gstin || 'Pending'}</span>
          <span>Bank: {currentFinanceProfile?.bank_name || 'Pending'} · {currentFinanceProfile?.payout_currency || 'INR'}</span>
          <small>Updated {currentFinanceProfile?.updated_at ? new Date(currentFinanceProfile.updated_at).toLocaleString() : 'after you save this form'}</small>
        </section>

        <form className="form-grid finance-profile-form" onSubmit={handleFinanceSubmit}>
          <TextInput label="Legal company name" required value={financeForm.legal_name} onChange={(event) => setFinanceForm({ ...financeForm, legal_name: event.target.value })} />
          <TextInput label="Account holder name" required value={financeForm.account_holder} onChange={(event) => setFinanceForm({ ...financeForm, account_holder: event.target.value })} />
          <TextInput label="Bank name" required value={financeForm.bank_name} onChange={(event) => setFinanceForm({ ...financeForm, bank_name: event.target.value })} />
          <TextInput label="Account number" required value={financeForm.account_number} onChange={(event) => setFinanceForm({ ...financeForm, account_number: event.target.value })} />
          <TextInput label="IFSC / routing code" required value={financeForm.ifsc} onChange={(event) => setFinanceForm({ ...financeForm, ifsc: event.target.value.toUpperCase() })} />
          <TextInput label="SWIFT code" value={financeForm.swift_code} onChange={(event) => setFinanceForm({ ...financeForm, swift_code: event.target.value.toUpperCase() })} />
          <SelectInput label="Payout currency" required value={financeForm.payout_currency} onChange={(event) => setFinanceForm({ ...financeForm, payout_currency: event.target.value })}>
            <option>INR</option>
            <option>GBP</option>
            <option>USD</option>
            <option>EUR</option>
            <option>AUD</option>
            <option>CAD</option>
          </SelectInput>
          <label className="switch-row">
            <input type="checkbox" checked={financeForm.gst_registered} onChange={(event) => setFinanceForm({ ...financeForm, gst_registered: event.target.checked })} />
            GST registered
          </label>
          <TextInput label="GSTIN" required={financeForm.gst_registered} value={financeForm.gstin} onChange={(event) => setFinanceForm({ ...financeForm, gstin: event.target.value.toUpperCase() })} />
          <TextInput label="PAN" required value={financeForm.pan} onChange={(event) => setFinanceForm({ ...financeForm, pan: event.target.value.toUpperCase() })} />
          <label className="field finance-address-field">
            <span>Billing address</span>
            <textarea required value={financeForm.billing_address} onChange={(event) => setFinanceForm({ ...financeForm, billing_address: event.target.value })} />
          </label>
          <label className="field finance-address-field">
            <span>Finance notes</span>
            <textarea value={financeForm.notes} onChange={(event) => setFinanceForm({ ...financeForm, notes: event.target.value })} />
          </label>
          <footer className="form-footer">
            <button className="primary-button" type="submit" disabled={financeSaving}>
              <Save size={16} />
              {financeSaving ? 'Saving...' : 'Save finance details'}
            </button>
          </footer>
        </form>
      </div>
    </Panel>
  );
}

export function Commissions() {
  const {
    currentUser,
    managers,
    organizations,
    users,
    visibleApplications,
    visibleCommissions,
    visiblePartnerFinanceProfiles,
    visibleStudents,
    updateCommission,
    updatePartnerFinanceProfile,
  } = useAppState();
  const [view, setView] = useState(currentUser.role === 'admin' ? 'partners' : 'profile');
  const [country, setCountry] = useState('All');
  const [year, setYear] = useState('2026');
  const [intake, setIntake] = useState('All');
  const [university, setUniversity] = useState('All');
  const [paymentStatus, setPaymentStatus] = useState('All');
  const [paymentQuery, setPaymentQuery] = useState('');
  const [serviceTab, setServiceTab] = useState(alliedServiceRows[0].category);
  const [ruleRows, setRuleRows] = useState(commissionStructureRows);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  useEffect(() => {
    let active = true;
    loadCommissionRules().then((rows) => {
      if (active) setRuleRows(rows);
    });
    return () => {
      active = false;
    };
  }, []);
  const projected = visibleCommissions.reduce((sum, item) => sum + Number(item.expected_amount || 0), 0);
  const paid = visibleCommissions.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.expected_amount || 0), 0);
  const currentFinanceProfile = visiblePartnerFinanceProfiles.find((profile) => profile.organization_id === currentUser.organization_id);
  const payoutCurrency = visibleCommissions[0]?.currency || currentFinanceProfile?.payout_currency || 'INR';
  const partnerOrgs = useMemo(() => organizations.filter((organization) => organization.kind !== 'admin'), [organizations]);
  const partnerSummaries = useMemo(() => partnerOrgs.map((organization) => {
    const manager = managers.find((user) => user.organization_id === organization.id || user.id === organization.primary_manager_id);
    const partnerApplications = partnerApplicationsFor(organization, manager, visibleApplications);
    const financeProfile = visiblePartnerFinanceProfiles.find((profile) => profile.organization_id === organization.id);
    return {
      organization,
      manager,
      counselors: users.filter((user) => user.role === 'counselor' && user.organization_id === organization.id),
      applications: partnerApplications,
      financeProfile,
      rejected: partnerApplications.filter((application) => ['offer_rejected', 'rejected'].includes(application.status)).length,
    };
  }), [managers, partnerOrgs, users, visibleApplications, visiblePartnerFinanceProfiles]);
  const countries = useMemo(() => ['All', ...new Set(ruleRows.map((item) => item.country).sort())], [ruleRows]);
  const years = useMemo(() => ['All', ...new Set(ruleRows.map((row) => row.year).filter(Boolean).sort())], [ruleRows]);
  const intakes = useMemo(() => ['All', ...new Set(ruleRows.map((row) => row.intake).filter(Boolean).sort())], [ruleRows]);
  const universities = useMemo(() => ['All', ...new Set(ruleRows.map((item) => item.university).sort())], [ruleRows]);
  const filteredRules = ruleRows.filter((rule) => {
    if (country !== 'All' && rule.country !== country) return false;
    if (year !== 'All' && rule.year !== year) return false;
    if (intake !== 'All' && rule.intake !== intake) return false;
    if (university !== 'All' && rule.university !== university) return false;
    return true;
  });
  const filteredPayments = visibleCommissions.filter((commission) => {
    if (paymentStatus !== 'All' && commission.status !== paymentStatus) return false;
    const student = visibleStudents.find((item) => item.id === commission.student_id);
    const haystack = `${student?.first_name} ${student?.last_name} ${student?.email} ${commission.university} ${commission.course} ${commission.id}`.toLowerCase();
    return haystack.includes(paymentQuery.toLowerCase());
  });
  const selectedServiceRows = alliedServiceRows.filter((row) => row.category === serviceTab);
  const activeView = currentUser.role === 'admin' && view === 'profile'
    ? 'partners'
    : currentUser.role === 'manager' && view === 'partners'
      ? 'profile'
      : view;

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Finance</h1>
          <p>Partner bank, GST, commission payment, and Videshway admin tracking for every submitted application.</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => setTutorialOpen(true)}>
          <PlayCircle size={17} />
          Watch Tutorial
        </button>
      </div>

      <Modal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title="Finance Workflow Tutorial"
        description="How managers and Videshway admin use finance in Bizzlo."
      >
        <div className="training-list">
          {[
            ['Manager account details', 'Manager saves legal name, GST, PAN, bank account, IFSC/SWIFT, and payout currency from Account Details.'],
            ['Admin verification', 'Videshway admin reviews GST, PAN, bank holder name, and billing address before approving finance readiness.'],
            ['Application stages', 'Commission tracking starts from submitted applications and moves through offer received, deposit paid, CAS/I-20/COE, visa, and enrolled.'],
            ['Payment tracking', 'Admin updates projected, ready to invoice, invoiced, and paid statuses so partners can see payment movement.'],
          ].map(([title, text]) => (
            <article className="partner-card" key={title}>
              <div>
                <PlayCircle size={18} />
                <strong>{title}</strong>
              </div>
              <span>{text}</span>
            </article>
          ))}
        </div>
      </Modal>

      <div className="stats-grid two">
        {currentUser.role === 'admin' ? (
          <section className="finance-card">
            <span>Active partners</span>
            <strong>{partnerSummaries.length}</strong>
          </section>
        ) : null}
        {currentUser.role === 'admin' ? (
          <section className="finance-card">
            <span>Submitted applications</span>
            <strong>{visibleApplications.length}</strong>
          </section>
        ) : null}
        <section className="finance-card">
          <span>Projected commission</span>
          <strong>{money(projected, payoutCurrency)}</strong>
        </section>
        <section className="finance-card">
          <span>Paid commission</span>
          <strong>{money(paid, payoutCurrency)}</strong>
        </section>
      </div>

      <div className="segmented-tabs">
        {currentUser.role === 'admin' ? (
          <button className={activeView === 'partners' ? 'active' : ''} type="button" onClick={() => setView('partners')}>Partner Tracker</button>
        ) : null}
        {currentUser.role === 'manager' ? (
          <button className={activeView === 'profile' ? 'active' : ''} type="button" onClick={() => setView('profile')}>Account Details</button>
        ) : null}
        <button className={activeView === 'structure' ? 'active' : ''} type="button" onClick={() => setView('structure')}>Partner Eligibility</button>
        <button className={activeView === 'allied' ? 'active' : ''} type="button" onClick={() => setView('allied')}>Allied Services</button>
        <button className={activeView === 'payments' ? 'active' : ''} type="button" onClick={() => setView('payments')}>Commission Payments</button>
      </div>

      {activeView === 'partners' && currentUser.role === 'admin' ? (
        <>
          <Panel title="Partner Application Tracker" description="Admin view of every partner, submitted application count, current stage mix, counselor seat usage, and finance verification.">
            <div className="partner-tracker-grid">
              {partnerSummaries.map(({ organization, manager, counselors, applications, financeProfile, rejected }) => (
                <article className="partner-tracker-card" key={organization.id}>
                  <header>
                    <div>
                      <Building2 size={18} />
                      <strong>{organization.name}</strong>
                    </div>
                    <StatusBadge value={financeProfile?.status || 'pending_admin_review'} />
                  </header>
                  <div className="partner-tracker-meta">
                    <span>Manager: {manager?.name || 'Awaiting setup'}</span>
                    <span>Counselors: {counselors.length}/{organization.counselor_limit || 1}</span>
                    <span>Applications submitted: <strong>{applications.length}</strong></span>
                  </div>
                  <div className="stage-count-strip">
                    {trackerStages.map((stage) => (
                      <span key={`${organization.id}-${stage}`}>
                        {labelFor(stage)}
                        <strong>{countByStatus(applications, stage)}</strong>
                      </span>
                    ))}
                    <span className={rejected ? 'danger' : ''}>
                      Rejected
                      <strong>{rejected}</strong>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Partner GST & Bank Verification" description="Admin can verify a manager's payout profile after checking GST, PAN, bank holder name, and billing address.">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Legal / GST</th>
                    <th>Bank details</th>
                    <th>Status</th>
                    <th>Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerSummaries.map(({ organization, financeProfile }) => (
                    <tr key={`finance-${organization.id}`}>
                      <td><strong>{organization.name}</strong><small>{financeProfile?.billing_address || 'Address pending'}</small></td>
                      <td>{financeProfile?.legal_name || 'Not submitted'}<small>{financeProfile?.gstin || 'GST pending'} · {financeProfile?.pan || 'PAN pending'}</small></td>
                      <td>{financeProfile?.bank_name || 'Bank pending'}<small>{financeProfile?.account_holder || 'Holder pending'} · {financeProfile?.ifsc || 'IFSC pending'}</small></td>
                      <td><StatusBadge value={financeProfile?.status || 'pending_admin_review'} /></td>
                      <td>
                        {financeProfile ? (
                          <div className="row-actions">
                            <button type="button" onClick={() => updatePartnerFinanceProfile({ ...financeProfile, status: 'verified' }).catch(() => {})}>Verify</button>
                            <button type="button" onClick={() => updatePartnerFinanceProfile({ ...financeProfile, status: 'admin_changes_requested' }).catch(() => {})}>Need changes</button>
                          </div>
                        ) : (
                          <span className="muted-copy inline">Waiting for manager</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}

      {activeView === 'profile' && currentUser.role === 'manager' ? (
        <ManagerFinanceProfile
          key={`${currentUser.id}-${currentFinanceProfile?.id || 'new'}`}
          currentFinanceProfile={currentFinanceProfile}
          currentUser={currentUser}
          updatePartnerFinanceProfile={updatePartnerFinanceProfile}
        />
      ) : null}

      {activeView === 'structure' ? (
        <Panel
          title="Partner University Eligibility"
          description="Country, intake, year, university, study-level coverage, and admin verification status. Financial values are kept out of this view."
          action={(
            <button className="secondary-button" type="button" onClick={() => downloadRows('bizzlo-partner-university-index.csv', commissionImportColumns, filteredRules)}>
              <Download size={15} />
              Export
            </button>
          )}
        >
          <div className="commission-filter-bar">
            <SelectInput label="Country" value={country} onChange={(event) => setCountry(event.target.value)}>
              {countries.map((item) => <option key={item}>{item}</option>)}
            </SelectInput>
            <SelectInput label="Year" value={year} onChange={(event) => setYear(event.target.value)}>
              {years.map((item) => <option key={item}>{item}</option>)}
            </SelectInput>
            <SelectInput label="Intake" value={intake} onChange={(event) => setIntake(event.target.value)}>
              {intakes.map((item) => <option key={item}>{item}</option>)}
            </SelectInput>
            <SelectInput label="University" value={university} onChange={(event) => setUniversity(event.target.value)}>
              {universities.map((item) => <option key={item}>{item}</option>)}
            </SelectInput>
            <button className="primary-button" type="button"><Search size={15} /> Search</button>
            <button className="secondary-button" type="button" onClick={() => { setCountry('All'); setYear('2026'); setIntake('All'); setUniversity('All'); }}>Clear All</button>
          </div>
          <div className="table-wrap commission-structure-table">
            <table>
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>University Name</th>
                  <th>Destination</th>
                  <th>Intake / Year</th>
                  <th>Study Level</th>
                  <th>Status</th>
                  <th>Admin Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule, index) => (
                  <tr key={rule.id}>
                    <td>{index + 1}</td>
                    <td>
                      <strong>{rule.university}</strong>
                      <small>{rule.country} · Last Updated on {rule.updatedAt}</small>
                    </td>
                    <td>{rule.country}<small>{rule.sourceCountry !== rule.country ? `Mapped from ${rule.sourceCountry}` : 'Partner PDF listed'}</small></td>
                    <td>{rule.intake}<small>{rule.year}</small></td>
                    <td>{rule.studyLevel}</td>
                    <td>
                      <Badge tone="success">{rule.eligibilityStatus}</Badge>
                      {rule.hasRestrictions ? <small>Restrictions may apply</small> : <small>Standard admin check</small>}
                    </td>
                    <td>
                      <div className="commission-terms-stack">
                        <strong>Verify exact course eligibility before submission.</strong>
                        <small>Commercial terms stay with Videshway finance/admin.</small>
                        <small>Partner PDF listing</small>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="si-eligibility-note">
            <strong>Financial values are kept out.</strong>
            <span>Bizzlo stores only partner-university eligibility metadata here. Finance-owned payouts and special terms stay outside the partner-facing structure table.</span>
          </div>
        </Panel>
      ) : null}

      {activeView === 'allied' ? (
        <Panel title="Allied Services" description="Service-wise eligibility and finance-control status for loans, housing, SIM, insurance, banking, forex, credential evaluation, and blocked account support.">
          <div className="commission-service-tabs">
            {alliedServiceRows.map((row) => (
              <button className={serviceTab === row.category ? 'active' : ''} type="button" key={row.id} onClick={() => setServiceTab(row.category)}>
                {row.category}
              </button>
            ))}
          </div>
          <div className="service-commission-grid">
            {selectedServiceRows.map((row) => (
              <article key={row.id}>
                <Badge tone="info">{row.partner}</Badge>
                <strong>{row.category}</strong>
                <dl>
                  <div><dt>Handling</dt><dd>{row.commercialHandling}</dd></div>
                  <div><dt>Trigger</dt><dd>{row.trigger}</dd></div>
                  <div><dt>Terms</dt><dd>{row.terms}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        </Panel>
      ) : null}

      {activeView === 'payments' ? (
        <>
          <Panel title="Payment Milestones" description="Payment state from projected commission to partner payout.">
            <div className="payment-timeline">
              {paymentMilestones.map((milestone) => (
                <article key={milestone.status}>
                  <StatusBadge value={milestone.status} />
                  <strong>{milestone.label}</strong>
                  <span>{milestone.description}</span>
                  <small>{visibleCommissions.filter((item) => item.status === milestone.status).length} record(s)</small>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="Commission Payments" description="Filter finance notes by status, university, student, email, and acknowledgement search.">
            <div className="commission-filter-bar payments">
              <TextInput label="Commission note number" value={paymentQuery} onChange={(event) => setPaymentQuery(event.target.value)} />
              <SelectInput label="Status" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>
                <option>All</option>
                {paymentMilestones.map((item) => <option value={item.status} key={item.status}>{item.label}</option>)}
              </SelectInput>
              <TextInput label="Parent company" value="Videshway" readOnly />
              <TextInput label="University / Student / Email" value={paymentQuery} onChange={(event) => setPaymentQuery(event.target.value)} />
              <button className="primary-button" type="button"><Search size={15} /> Apply Filters</button>
            </div>
            {filteredPayments.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>University</th>
                      <th>Application</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Next step</th>
                      {currentUser.role === 'admin' ? <th>Admin</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((commission) => {
                      const student = visibleStudents.find((item) => item.id === commission.student_id);
                      return (
                        <tr key={commission.id}>
                          <td>{student?.first_name} {student?.last_name}<small>{student?.email}</small></td>
                          <td>{commission.university}</td>
                          <td>{commission.course}</td>
                          <td><strong>{money(commission.expected_amount, commission.currency)}</strong></td>
                          <td><StatusBadge value={commission.status} /></td>
                          <td>{commission.status === 'ready_to_invoice' ? 'Raise invoice' : labelFor(commission.status)}</td>
                          {currentUser.role === 'admin' ? (
                            <td>
                              <button
                                className="row-icon-button"
                                type="button"
                                onClick={() => updateCommission(commission.id, { status: commission.status === 'paid' ? 'projected' : 'paid' }).catch(() => {})}
                              >
                                <Pencil size={15} />
                                Toggle paid
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Landmark} title="No outstanding commission notes" text="Paid or in-progress notes will appear once the filters match a finance record." />
            )}
          </Panel>
        </>
      ) : null}

      <Panel>
        <div className="security-note">
          <Landmark size={18} />
          <span>Production commission rows are generated from applications and controlled by Videshway finance/admin roles.</span>
        </div>
      </Panel>
    </div>
  );
}
