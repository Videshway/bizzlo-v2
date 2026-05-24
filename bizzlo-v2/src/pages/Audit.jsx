import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAppState } from '../lib/appState';
import { isAdminRole } from '../lib/roles';
import { EmptyState, Panel, SelectInput, TextInput } from '../components/ui';

function formatDate(value) {
  if (!value) return 'Unknown time';
  return new Date(value).toLocaleString();
}

export function Audit() {
  const { auditEvents, currentUser } = useAppState();
  const [entityType, setEntityType] = useState('All');
  const [action, setAction] = useState('All');
  const [query, setQuery] = useState('');

  const entityTypes = useMemo(() => ['All', ...new Set(auditEvents.map((event) => event.entity_type).filter(Boolean).sort())], [auditEvents]);
  const actions = useMemo(() => ['All', ...new Set(auditEvents.map((event) => event.action).filter(Boolean).sort())], [auditEvents]);
  const filtered = auditEvents.filter((event) => {
    if (entityType !== 'All' && event.entity_type !== entityType) return false;
    if (action !== 'All' && event.action !== action) return false;
    const haystack = `${event.entity_type} ${event.action} ${event.actor_name} ${JSON.stringify(event.metadata || {})}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  if (!isAdminRole(currentUser.role)) {
    return (
      <div className="page-grid">
        <Panel>
          <EmptyState icon={ShieldCheck} title="Admin only" text="Audit events are visible only to Videshway admin accounts." />
        </Panel>
      </div>
    );
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Audit Trail</h1>
          <p>Last 500 security and workflow events across applications, documents, commissions, and account invites.</p>
        </div>
      </div>

      <Panel title="Audit Events" description="Filter by entity, action, actor, or metadata.">
        <div className="toolbar audit-toolbar">
          <SelectInput label="Entity" value={entityType} onChange={(event) => setEntityType(event.target.value)}>
            {entityTypes.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <SelectInput label="Action" value={action} onChange={(event) => setAction(event.target.value)}>
            {actions.map((item) => <option key={item}>{item}</option>)}
          </SelectInput>
          <TextInput label="Search" placeholder="Actor, action, metadata..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>

        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Metadata</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDate(event.created_at)}</td>
                    <td>{event.actor_name}</td>
                    <td>{event.entity_type}<small>{event.entity_id}</small></td>
                    <td>{event.action}</td>
                    <td><code className="metadata-cell">{JSON.stringify(event.metadata || {})}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={ShieldCheck} title="No audit events" text="Events appear after applications, documents, commissions, invites, and downloads move through the system." />
        )}
      </Panel>
    </div>
  );
}
