'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch((error) => {
      console.warn('Sage Cinema PWA registration failed:', error);
    });
  }, []);

  return null;
}
