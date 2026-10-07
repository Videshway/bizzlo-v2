import { X } from 'lucide-react';
import { useEffect, useEffectEvent, useId, useRef } from 'react';
import { labelFor, statusTone } from '../lib/status';

const activeDialogs = [];
let bodyOverflowBeforeDialogs = '';

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

export function Modal({ title, description, open, onClose, children, className = '' }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    if (!activeDialogs.length) bodyOverflowBeforeDialogs = document.body.style.overflow;
    activeDialogs.push(dialog);
    const focusable = () => Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'))
      .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
    document.body.style.overflow = 'hidden';
    (dialog.querySelector('[data-autofocus]') || focusable()[0] || dialog).focus();

    const handleKeyDown = (event) => {
      if (activeDialogs.at(-1) !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const containFocus = (event) => {
      if (activeDialogs.at(-1) !== dialog) return;
      if (!dialog.contains(event.target)) (focusable()[0] || dialog).focus();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', containFocus);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', containFocus);
      const index = activeDialogs.indexOf(dialog);
      if (index !== -1) activeDialogs.splice(index, 1);
      if (!activeDialogs.length) document.body.style.overflow = bodyOverflowBeforeDialogs;
      const activeDialog = activeDialogs.at(-1);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && (!activeDialog || activeDialog.contains(previousFocus))) previousFocus.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1}>
        <div className="modal-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
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
