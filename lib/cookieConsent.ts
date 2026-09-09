'use client';

import { useEffect, useState } from 'react';

export const COOKIE_CONSENT_EVENT = 'sage-cinema-cookie-consent-change';
export const COOKIE_SETTINGS_EVENT = 'sage-cinema-open-cookie-settings';

const STORAGE_KEY = 'sage-cinema-cookie-consent-v1';

export interface CookiePreferences {
  analytics: boolean;
  advertising: boolean;
}

function isPreferences(value: unknown): value is CookiePreferences {
  if (!value || typeof value !== 'object') return false;
  const preferences = value as Partial<CookiePreferences>;
  return typeof preferences.analytics === 'boolean' && typeof preferences.advertising === 'boolean';
}

export function readCookieConsent(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null') as unknown;
    return isPreferences(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function saveCookieConsent(preferences: CookiePreferences) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // The banner still applies the choice for this session when storage is blocked.
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}

export function hasCookieConsent(category: keyof CookiePreferences) {
  return readCookieConsent()?.[category] === true;
}

export function requestCookieSettings() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
}

export function useCookieConsent() {
  const [preferences, setPreferences] = useState<CookiePreferences | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setPreferences(readCookieConsent());
    const handleSettings = () => sync();
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    window.addEventListener(COOKIE_SETTINGS_EVENT, handleSettings);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
      window.removeEventListener(COOKIE_SETTINGS_EVENT, handleSettings);
    };
  }, []);

  return preferences;
}
