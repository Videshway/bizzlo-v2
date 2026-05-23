import { useState } from 'react';
import { telemetryEnabled } from '../lib/telemetry';

const storageKey = 'bizzlo-cookie-consent';

export function CookieConsent() {
  const [visible, setVisible] = useState(() => (
    telemetryEnabled() && window.localStorage.getItem(storageKey) !== 'accepted'
  ));

  if (!visible) return null;

  return (
    <div className="cookie-banner">
      <span>Bizzlo uses essential security cookies and optional analytics to improve reliability.</span>
      <button
        type="button"
        onClick={() => {
          window.localStorage.setItem(storageKey, 'accepted');
          setVisible(false);
        }}
      >
        Accept
      </button>
    </div>
  );
}
