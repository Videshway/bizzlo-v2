import { useState } from 'react';
import { CheckCircle2, Download, LifeBuoy, MessageSquarePlus, PlayCircle, Plus } from 'lucide-react';
import {
  partnerServices,
  resourceCategories,
  resourceCountries,
  resourceDocuments,
  resourceLibrary,
  trainingModules,
} from '../data/referenceWorkflow';
import { useAppState } from '../lib/appState';
import { Badge, EmptyState, Modal, Panel, SelectInput, StatusBadge, TextInput } from '../components/ui';

function downloadResource(resource) {
  if (resource.file_url) {
    const link = document.createElement('a');
    link.href = resource.file_url;
    link.download = resource.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const body = [
    `Bizzlo Resource: ${resource.title}`,
    `Category: ${resource.category}`,
    `Format: ${resource.type}`,
    '',
    resource.summary,
    '',
    'Use this as the internal working version for counselor training, partner onboarding, and student-file operations.',
  ].join('\n');
  const blob = new Blob([body], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resource.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function downloadCountryResource(resource) {
  const isPresentation = resource.type === 'PPT';
  const body = [
    isPresentation ? '<html><body>' : '',
    isPresentation ? `<h1>${resource.title}</h1>` : `Bizzlo Resource: ${resource.title}`,
    isPresentation ? `<h2>${resource.country} ${resource.category}</h2>` : `Country: ${resource.country}`,
    isPresentation ? '<ul>' : `Category: ${resource.category}`,
    isPresentation ? `<li>Updated: ${resource.date}</li>` : `Format: ${resource.type}`,
    isPresentation ? `<li>Market: ${resource.market}</li>` : `Updated: ${resource.date}`,
    isPresentation ? `<li>${resource.summary}</li>` : `Size reference: ${resource.size}`,
    isPresentation ? '<li>Use this deck for partner counseling, document collection, and student application readiness.</li>' : '',
    isPresentation ? '</ul><h2>Workflow</h2><ol><li>Confirm student profile and destination fit.</li><li>Collect required documents.</li><li>Shortlist partner universities.</li><li>Move application to admin review.</li></ol></body></html>' : '',
    isPresentation ? '' : '',
    isPresentation ? '' : resource.summary,
    isPresentation ? '' : '',
    isPresentation ? '' : 'Production note: replace this generated working copy with the final Videshway-owned PDF/PPT before public partner rollout.',
  ].filter(Boolean).join(isPresentation ? '' : '\n');
  const blob = new Blob([body], { type: isPresentation ? 'application/vnd.ms-powerpoint' : 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = isPresentation ? resource.filename : resource.filename.replace(/\.pdf$/i, '.txt');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function Resources() {
  const { addServiceRequest, completedTrainingModules, serviceRequests, toggleTrainingModule } = useAppState();
  const completedModules = new Set(completedTrainingModules);
  const [resourceCountry, setResourceCountry] = useState(resourceCountries[0]?.id || '');
  const [resourceCategory, setResourceCategory] = useState(resourceCategories[0] || '');
  const [resourceSearch, setResourceSearch] = useState('');
  const selectedCountry = resourceCountries.find((country) => country.id === resourceCountry) || resourceCountries[0];
  const visibleResources = resourceDocuments.filter((resource) => {
    if (resource.countryId !== selectedCountry?.id) return false;
    if (resourceCategory && resource.category !== resourceCategory) return false;
    const haystack = `${resource.title} ${resource.category} ${resource.country} ${resource.market}`.toLowerCase();
    return haystack.includes(resourceSearch.toLowerCase());
  });

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>360 Solutions & TrainHub</h1>
          <p>Partner services, counselor enablement, and student add-ons in one operational resource center.</p>
        </div>
      </div>

      <Panel title="360 Solutions" description="Attach service requests to student files after course selection, offer, or visa movement.">
        <div className="service-grid">
          {partnerServices.map((service) => {
            const Icon = service.icon;
            return (
              <article key={service.title}>
                <Icon size={21} />
                <div>
                  <strong>{service.title}</strong>
                  <p>{service.text}</p>
                </div>
                <Badge tone={service.status === 'Required' ? 'warning' : 'info'}>{service.status}</Badge>
                <button className="secondary-button" type="button" onClick={() => addServiceRequest(service).catch(() => {})}>
                  <Plus size={15} />
                  Request
                </button>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="Country Resource Library" description="Videshway folders for country guides, presentations, application forms, visa packs, samples, webinars, and latest updates.">
        <div className="kc-resource-layout">
          <aside className="country-rail" aria-label="Countries">
            {resourceCountries.map((country) => (
              <button className={country.id === selectedCountry?.id ? 'active' : ''} type="button" key={country.id} onClick={() => setResourceCountry(country.id)}>
                <strong>{country.code}</strong>
                <span>{country.name}</span>
              </button>
            ))}
          </aside>
          <section className="resource-browser">
            <div className="resource-browser-head">
              <div>
                <strong>{selectedCountry?.name}</strong>
                <span>{resourceDocuments.filter((resource) => resource.countryId === selectedCountry?.id).length} resources available</span>
              </div>
              <TextInput label="Search document" value={resourceSearch} onChange={(event) => setResourceSearch(event.target.value)} />
            </div>
            <div className="resource-category-list">
              {resourceCategories.map((category) => (
                <button className={category === resourceCategory ? 'active' : ''} type="button" key={category} onClick={() => setResourceCategory(category)}>
                  <span className="folder-icon" />
                  <span>{category}</span>
                </button>
              ))}
            </div>
            <div className="resource-document-list">
              <h3>Documents</h3>
              {visibleResources.length ? visibleResources.map((resource) => (
                <article key={resource.id}>
                  <div>
                    <strong>{resource.title}</strong>
                    <span>{resource.date} · {resource.size} · {resource.type} · {resource.market}</span>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => downloadCountryResource(resource)}>
                    <Download size={15} />
                    Download
                  </button>
                </article>
              )) : (
                <EmptyState icon={Download} title="No documents in this folder" text="Choose another category or clear the search." />
              )}
            </div>
          </section>
        </div>
      </Panel>

      <Panel title="Bizzlo Core Packs" description="Bizzlo-owned partner decks, templates, SOPs, and country guides for 360 support.">
        <div className="resource-grid">
          {resourceLibrary.map((resource) => {
            const Icon = resource.icon;
            return (
              <article key={resource.title}>
                <div className="resource-head">
                  <Icon size={20} />
                  <Badge tone={resource.type === 'PPT' ? 'info' : 'neutral'}>{resource.type}</Badge>
                </div>
                <strong>{resource.title}</strong>
                <span>{resource.category}</span>
                <p>{resource.summary}</p>
                <button className="secondary-button" type="button" onClick={() => downloadResource(resource)}>
                  <Download size={15} />
                  Download
                </button>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="Service Request Queue" description="Requests made by partner users land here for Videshway team handling.">
        {serviceRequests.length ? (
          <div className="request-list">
            {serviceRequests.map((request) => (
              <article key={request.id}>
                <CheckCircle2 size={17} />
                <div>
                  <strong>{request.title}</strong>
                  <span>{request.requester_name} · {new Date(request.created_at).toLocaleString()}</span>
                </div>
                <StatusBadge value={request.status} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState icon={LifeBuoy} title="No service requests yet" text="Use Request on any 360 Solution to create one." />
        )}
      </Panel>

      <Panel title="TrainHub" description="Short modules for partner managers and counselors.">
        <div className="training-list">
          {trainingModules.map((module) => (
            <button type="button" key={module.title} onClick={() => toggleTrainingModule(module.title).catch(() => {})}>
              <span className="training-icon">{completedModules.has(module.title) ? <CheckCircle2 size={18} /> : <PlayCircle size={18} />}</span>
              <span>
                <strong>{module.title}</strong>
                <small>{module.meta}</small>
              </span>
              <Badge tone={completedModules.has(module.title) ? 'success' : 'info'}>{completedModules.has(module.title) ? 'completed' : 'start'}</Badge>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function Support() {
  const { addSupportTicket, supportTickets } = useAppState();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: 'Application query',
    title: '',
    message: '',
  });

  async function submitTicket(event) {
    event.preventDefault();
    await addSupportTicket(form);
    setForm({ type: 'Application query', title: '', message: '' });
    setOpen(false);
  }

  return (
    <div className="page-grid">
      <div className="page-heading">
        <div>
          <h1>Support Desk</h1>
          <p>Application-linked questions, partner escalation, and admin replies.</p>
        </div>
        <button className="primary-button" type="button" onClick={() => setOpen(true)}>
          <MessageSquarePlus size={17} />
          New ticket
        </button>
      </div>

      <Panel title="Support Tickets" description="Demo ticket flow for production partner support.">
        <div className="support-board">
          <article>
            <LifeBuoy size={20} />
            <strong>Application query</strong>
            <span>Ask Videshway admin about a student file, document, or university submission.</span>
            <button className="secondary-button" type="button" onClick={() => setOpen(true)}><MessageSquarePlus size={16} /> New ticket</button>
          </article>
          {supportTickets.length ? (
            <div className="ticket-list">
              {supportTickets.map((ticket) => (
                <article key={ticket.id}>
                  <strong>{ticket.title}</strong>
                  <span>{ticket.type} · {ticket.requester_name} · {new Date(ticket.created_at).toLocaleString()}</span>
                  <p>{ticket.message}</p>
                  <StatusBadge value={ticket.status} />
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={LifeBuoy} title="No open support tickets" text="New production tickets can attach to student and application records." />
          )}
        </div>
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} title="New Support Ticket" description="Send a partner support request to the Videshway admin team.">
        <form className="form-grid" onSubmit={(event) => submitTicket(event).catch(() => {})}>
          <SelectInput label="Ticket type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option>Application query</option>
            <option>Document issue</option>
            <option>Commission query</option>
            <option>Technical support</option>
          </SelectInput>
          <TextInput label="Subject" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <label className="field form-wide">
            <span>Message</span>
            <textarea required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
          </label>
          <footer className="form-footer">
            <button className="secondary-button" type="button" onClick={() => setOpen(false)}>Cancel</button>
            <button className="primary-button" type="submit">Create ticket</button>
          </footer>
        </form>
      </Modal>
    </div>
  );
}
