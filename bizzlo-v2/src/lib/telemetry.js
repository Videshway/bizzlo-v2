const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

function sentryEndpoint() {
  if (!sentryDsn) return null;
  try {
    const url = new URL(sentryDsn);
    const projectId = url.pathname.replace('/', '');
    const key = url.username;
    return `${url.protocol}//${url.host}/api/${projectId}/store/?sentry_key=${key}&sentry_version=7`;
  } catch {
    return null;
  }
}

export function initTelemetry() {
  if (sentryDsn) {
    window.addEventListener('error', (event) => {
      captureException(event.error || event.message, { source: 'window.error' });
    });
    window.addEventListener('unhandledrejection', (event) => {
      captureException(event.reason, { source: 'unhandledrejection' });
    });
  }
}

export function captureException(error, context = {}) {
  const endpoint = sentryEndpoint();
  if (!endpoint) return;
  const message = error?.message || String(error || 'Unknown error');
  fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: crypto.randomUUID().replaceAll('-', ''),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      logger: 'bizzlo-web',
      message,
      extra: context,
    }),
    keepalive: true,
  }).catch(() => {});
}

export function captureEvent(event, properties = {}, user = null) {
  if (!posthogKey) return;
  fetch(`${posthogHost}/capture/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: posthogKey,
      event,
      distinct_id: user?.id || 'anonymous',
      properties: {
        ...properties,
        organization_id: user?.organization_id,
      },
    }),
    keepalive: true,
  }).catch(() => {});
}

export function telemetryEnabled() {
  return Boolean(posthogKey);
}

