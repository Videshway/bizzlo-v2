import { X } from 'lucide-react';
import { labelFor, statusTone } from '../lib/status';

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusBadge({ value }) {
  return <Badge tone={statusTone[value] || (value === 'rejected' ? 'danger' : 'neutral')}>{labelFor(value)}</Badge>;
}

export function StatCard({ icon, label, value, hint, tone = 'blue' }) {
  const Icon = icon;

  return (
    <section className="stat-card">
      <div>
        <p className="eyebrow-text">{label}</p>
        <strong>{value}</strong>
        {hint ? <span>{hint}</span> : null}
      </div>
      <div className={`stat-icon tone-${tone}`}>
        <Icon size={21} />
      </div>
    </section>
  );
}

export function Panel({ title, description, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {(title || description || action) && (
        <div className="panel-header">
          <div>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Modal({ title, description, open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TextInput({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

export function SelectInput({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}

export function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="empty-state">
      {Icon ? <Icon size={32} /> : null}
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
    </div>
  );
}
