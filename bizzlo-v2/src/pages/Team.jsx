import { useMemo, useState } from 'react';
import { Building2, CheckCircle2, UserPlus, UsersRound } from 'lucide-react';
import { useAppState } from '../lib/appState';
import { Badge, Panel, SelectInput, StatusBadge, TextInput } from '../components/ui';

const emptyPartner = {
  organization_name: '',
  full_name: '',
  email: '',
  portal_username: '',
  initial_password: '',
  counselor_limit: 1,
};

const emptyCounselor = {
  full_name: '',
  email: '',
  portal_username: '',
  initial_password: '',
};

function portalUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 48);
}

export function Team() {
  const {
    accountRequests,
    addPartnerAccount,
    currentUser,
    managerCounselors,
    managers,
    organizations,
    createAccountLogin,
    requestCounselorAccount,
    updateAccountRequest,
    updatePartnerSeatLimit,
    users,
  } = useAppState();
  const [partner, setPartner] = useState(emptyPartner);
  const [counselor, setCounselor] = useState(emptyCounselor);
  const [requestPasswords, setRequestPasswords] = useState({});
  const [credentialReceipts, setCredentialReceipts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const partnerOrgs = useMemo(() => organizations.filter((organization) => organization.kind !== 'admin'), [organizations]);
  const currentOrg = organizations.find((organization) => organization.id === currentUser.organization_id);
  const counselorLimit = Number(currentOrg?.counselor_limit || 1);
  const usedCounselorSeats = managerCounselors.length;
  const canRequestCounselor = currentUser.role === 'manager' && usedCounselorSeats < counselorLimit;

  function updatePartnerCompany(value) {
    setPartner((current) => ({
      ...current,
      organization_name: value,
      portal_username: current.portal_username || portalUsername(value),
    }));
  }

  function updateCounselorName(value) {
    setCounselor((current) => ({
      ...current,
      full_name: value,
      portal_username: current.portal_username || portalUsername(value),
    }));
  }

  function updateCounselorEmail(value) {
    setCounselor((current) => ({
      ...current,
      email: value,
      portal_username: current.portal_username || portalUsername(value.split('@')[0]),
    }));
  }

  function rememberCredential(account, password) {
    setCredentialReceipts((current) => [{
      id: `${account.id || account.user_id || Date.now()}-${Date.now()}`,
      role: account.role,
      name: account.full_name || account.name,
      email: account.email,
      portal_username: account.portal_username,
      password,
    }, ...current].slice(0, 5));
  }

  async function handlePartnerSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const account = await addPartnerAccount(partner);
      rememberCredential(account, partner.initial_password);
      setPartner(emptyPartner);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCounselorSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const account = await requestCounselorAccount(counselor);
      rememberCredential(account, counselor.initial_password);
      setCounselor(emptyCounselor);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateLogin(request) {
    const password = requestPasswords[request.id] || '';
    const account = await createAccountLogin(request.id, password);
    rememberCredential({ ...request, ...account }, password);
    setRequestPasswords((current) => ({ ...current, [request.id]: '' }));
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Team & Partners</h1>
          <p>Videshway admin creates partner managers. Partner managers create counselor logins inside their own portal.</p>
        </div>
      </div>

      {credentialReceipts.length ? (
        <Panel title="One-Time Login Receipts" description="Share these credentials now. Passwords are not stored as readable text after this screen refreshes.">
          <div className="partner-stack">
            {credentialReceipts.map((receipt) => (
              <article className="partner-card" key={receipt.id}>
                <div>
                  <CheckCircle2 size={18} />
                  <strong>{receipt.name || receipt.email}</strong>
                  <Badge tone="success">{receipt.role || 'login'}</Badge>
                </div>
                <span>Username: {receipt.portal_username} - Password: {receipt.password}</span>
                <span>Email: {receipt.email}</span>
              </article>
            ))}
          </div>
        </Panel>
      ) : null}

      {currentUser.role === 'admin' ? (
        <>
          <div className="dashboard-columns">
            <Panel title="Create Partner Manager" description="This creates the partner organization and active manager login immediately.">
              <form className="form-grid compact-form" onSubmit={handlePartnerSubmit}>
                <TextInput label="Partner company" required value={partner.organization_name} onChange={(event) => updatePartnerCompany(event.target.value)} />
                <TextInput label="Portal username" required minLength={3} pattern="[a-z0-9._-]{3,48}" placeholder="partner-login-id" value={partner.portal_username} onChange={(event) => setPartner({ ...partner, portal_username: portalUsername(event.target.value) })} />
                <TextInput label="Manager name" required value={partner.full_name} onChange={(event) => setPartner({ ...partner, full_name: event.target.value })} />
                <TextInput label="Manager email" type="email" required value={partner.email} onChange={(event) => setPartner({ ...partner, email: event.target.value })} />
                <TextInput label="Initial password" type="password" required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" value={partner.initial_password} onChange={(event) => setPartner({ ...partner, initial_password: event.target.value })} />
                <SelectInput label="Counselor seats" value={partner.counselor_limit} onChange={(event) => setPartner({ ...partner, counselor_limit: event.target.value })}>
                  <option value="1">1 counselor</option>
                  <option value="2">2 counselors</option>
                  <option value="3">3 counselors</option>
                </SelectInput>
                <footer className="form-footer">
                  <button className="primary-button" type="submit" disabled={submitting}>
                    <UserPlus size={16} />
                    {submitting ? 'Creating...' : 'Create partner'}
                  </button>
                </footer>
              </form>
            </Panel>

            <Panel title="Partner Accounts" description="Managers own partner visibility and commission. Counselors work under the manager.">
              <div className="partner-stack">
                {partnerOrgs.map((organization) => {
                  const manager = managers.find((user) => user.organization_id === organization.id || user.id === organization.primary_manager_id);
                  const managerRequest = accountRequests.find((request) => request.role === 'manager' && request.organization_id === organization.id);
                  const counselors = users.filter((user) => user.role === 'counselor' && user.organization_id === organization.id);
                  const portalLogin = manager?.portal_username || managerRequest?.portal_username || 'Awaiting allocation';
                  const loginEmail = manager?.email || managerRequest?.email || 'Invite not sent';
                  const seatLimit = Number(organization.counselor_limit || 1);
                  return (
                    <article className="partner-card" key={organization.id}>
                      <div>
                        <Building2 size={18} />
                        <strong>{organization.name}</strong>
                        <Badge tone={organization.status === 'active' ? 'success' : 'warning'}>{organization.status || 'active'}</Badge>
                      </div>
                      <span>Manager: {manager?.name || managerRequest?.full_name || 'Awaiting setup'} - Counselors: {counselors.length}/{seatLimit}</span>
                      <span>Portal username: {portalLogin} - Email: {loginEmail}</span>
                      <span>Password: set by admin. Use Create login again with a new password to reset.</span>
                      <label className="field compact-field">
                        <span>Counselor seats</span>
                        <select value={seatLimit} onChange={(event) => updatePartnerSeatLimit(organization.id, event.target.value).catch(() => {})}>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((count) => (
                            <option key={count} value={count}>{count} {count === 1 ? 'seat' : 'seats'}</option>
                          ))}
                        </select>
                      </label>
                    </article>
                  );
                })}
              </div>
            </Panel>
          </div>

          <Panel title="Videshway Account Login Board" description="Create or reset logins directly. No Supabase dashboard step is needed.">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Portal login</th>
                    <th>Role</th>
                    <th>Partner</th>
                    <th>Status</th>
                    <th>Create login</th>
                  </tr>
                </thead>
                <tbody>
                  {accountRequests.map((request) => (
                    <tr key={request.id}>
                      <td><strong>{request.full_name}</strong><small>{request.email}</small></td>
                      <td><strong>{request.portal_username || 'Not allocated'}</strong><small>{request.email}</small></td>
                      <td>{request.role}</td>
                      <td>{request.organization_name}</td>
                      <td><StatusBadge value={request.status} /></td>
                      <td>
                        <div className="row-actions">
                          <input type="password" minLength={8} placeholder="New password" value={requestPasswords[request.id] || ''} onChange={(event) => setRequestPasswords((current) => ({ ...current, [request.id]: event.target.value }))} />
                          <button type="button" onClick={() => handleCreateLogin(request).catch(() => {})}>Create login</button>
                          <button type="button" onClick={() => updateAccountRequest(request.id, 'needs_login_creation').catch(() => {})}>Needs login</button>
                          <button type="button" onClick={() => updateAccountRequest(request.id, 'cancelled').catch(() => {})}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      ) : null}

      {currentUser.role === 'manager' ? (
        <div className="dashboard-columns">
          <Panel title="Counselor Seat" description="Default partner setup allows one counselor. Videshway admin can increase seats later.">
            <div className="seat-meter">
              <UsersRound size={20} />
              <strong>{usedCounselorSeats}/{counselorLimit}</strong>
              <span>counselor seat used</span>
            </div>
            <form className="form-grid compact-form" onSubmit={handleCounselorSubmit}>
              <TextInput label="Counselor name" required disabled={!canRequestCounselor} value={counselor.full_name} onChange={(event) => updateCounselorName(event.target.value)} />
              <TextInput label="Counselor email" type="email" required disabled={!canRequestCounselor} value={counselor.email} onChange={(event) => updateCounselorEmail(event.target.value)} />
              <TextInput label="Portal username" required minLength={3} pattern="[a-z0-9._-]{3,48}" disabled={!canRequestCounselor} value={counselor.portal_username} onChange={(event) => setCounselor({ ...counselor, portal_username: portalUsername(event.target.value) })} />
              <TextInput label="Initial password" type="password" required minLength={8} autoComplete="new-password" disabled={!canRequestCounselor} placeholder="At least 8 characters" value={counselor.initial_password} onChange={(event) => setCounselor({ ...counselor, initial_password: event.target.value })} />
              <footer className="form-footer">
                <button className="primary-button" type="submit" disabled={submitting || !canRequestCounselor}>
                  <UserPlus size={16} />
                  {canRequestCounselor ? 'Create counselor' : 'Seat full'}
                </button>
              </footer>
            </form>
          </Panel>

          <Panel title="Active Counselor" description="Counselors add student files, upload documents, and submit applications to Videshway admin.">
            <div className="partner-stack">
              {managerCounselors.map((item) => (
                <article className="partner-card" key={item.id}>
                  <div>
                    <CheckCircle2 size={18} />
                    <strong>{item.name}</strong>
                    <Badge tone="success">active</Badge>
                  </div>
                  <span>{item.email}</span>
                  <span>Username: {item.portal_username || 'Not allocated'}</span>
                </article>
              ))}
              {managerCounselors.length === 0 ? <p className="muted-copy">No counselor has been created yet.</p> : null}
            </div>
          </Panel>
        </div>
      ) : null}

      {currentUser.role === 'counselor' ? (
        <Panel title="Your Account" description="Your manager controls partner access. Videshway admin sees applications and documents after you submit them.">
          <div className="security-note">
            <CheckCircle2 size={18} />
            <span>You can create student files, select universities, upload documents, and move applications to admin review.</span>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
