import './route-loading.css';

export function RouteLoading({ label = 'page' }) {
  return (
    <section className="panel route-loading" role="status" aria-live="polite" aria-busy="true">
      <p>Opening {label}…</p>
      <div className="route-loading-bars" aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
  );
}
