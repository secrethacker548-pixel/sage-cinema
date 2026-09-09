'use client';

import Link from 'next/link';
import { Check, Cookie, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  type CookiePreferences,
  COOKIE_SETTINGS_EVENT,
  saveCookieConsent,
  useCookieConsent,
} from '../lib/cookieConsent';

const ACCEPT_ALL: CookiePreferences = { analytics: true, advertising: true };
const NECESSARY_ONLY: CookiePreferences = { analytics: false, advertising: false };

export default function CookieConsent() {
  const preferences = useCookieConsent();
  const [isOpen, setIsOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [draft, setDraft] = useState<CookiePreferences>(ACCEPT_ALL);

  useEffect(() => {
    const openSettings = () => {
      setDraft(preferences || ACCEPT_ALL);
      setShowDetails(true);
      setIsOpen(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings);
  }, [preferences]);

  if (preferences === undefined) return null;
  if (preferences && !isOpen) return null;

  const save = (next: CookiePreferences) => {
    saveCookieConsent(next);
    setIsOpen(false);
    setShowDetails(false);
  };

  return (
    <aside className="cookie-consent" role="dialog" aria-label="Cookie preferences" aria-live="polite">
      <div className="cookie-consent-copy">
        <span className="cookie-consent-icon"><Cookie size={18} /></span>
        <div>
          <strong>{preferences ? 'Privacy choices' : 'A small privacy choice'}</strong>
          <p>
            Sage Cinema uses necessary browser storage to remember your watch state. Optional analytics and advertising stay off unless you allow them.
            {' '}<Link href="/privacy">Read the privacy policy</Link>.
          </p>
        </div>
      </div>

      {showDetails && (
        <div className="cookie-consent-details">
          <label className="cookie-consent-option">
            <input type="checkbox" checked disabled />
            <span><strong>Necessary</strong><small>Watch progress, preferences, and consent storage.</small></span>
            <em>Always on</em>
          </label>
          <label className="cookie-consent-option">
            <input
              type="checkbox"
              checked={draft.analytics}
              onChange={(event) => setDraft((current) => ({ ...current, analytics: event.target.checked }))}
            />
            <span><strong>Analytics</strong><small>Anonymous visit and movie-view counters.</small></span>
          </label>
          <label className="cookie-consent-option">
            <input
              type="checkbox"
              checked={draft.advertising}
              onChange={(event) => setDraft((current) => ({ ...current, advertising: event.target.checked }))}
            />
            <span><strong>Advertising</strong><small>Optional third-party ad and promotion scripts.</small></span>
          </label>
        </div>
      )}

      <div className="cookie-consent-actions">
        {!showDetails ? (
          <>
            <button type="button" className="cookie-button cookie-button-primary" onClick={() => save(ACCEPT_ALL)}><Check size={15} /> Accept all</button>
            <button type="button" className="cookie-button" onClick={() => save(NECESSARY_ONLY)}>Only necessary</button>
            <button type="button" className="cookie-button cookie-button-quiet" onClick={() => setShowDetails(true)}><Settings2 size={15} /> Customize</button>
          </>
        ) : (
          <>
            <button type="button" className="cookie-button cookie-button-primary" onClick={() => save(draft)}>Save preferences</button>
            <button type="button" className="cookie-button" onClick={() => save(NECESSARY_ONLY)}>Only necessary</button>
            <button type="button" className="cookie-button cookie-button-quiet" onClick={() => setShowDetails(false)}>Back</button>
          </>
        )}
      </div>
    </aside>
  );
}

export function CookieSettingsButton() {
  return (
    <button type="button" className="cookie-settings-link" onClick={() => {
      window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
    }}>
      Privacy choices
    </button>
  );
}
