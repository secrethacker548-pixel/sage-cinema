import './globals.css';
import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import type { ReactNode } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import PwaRegister from '../components/PwaRegister';
import ScrollToTop from '../components/ScrollToTop';
import { AppProvider } from '../lib/context/AppContext';

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
  weight: ['500', '600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://sage-cinema.phcodesage.chatgpt.site'),
  title: {
    default: 'Sage Cinema — Find a world',
    template: '%s | Sage Cinema',
  },
  description: 'A cinematic, interactive movie discovery experience powered by the Sage Movies data layer.',
  keywords: ['movies', 'TV series', 'anime', 'Sage Cinema', 'TMDB'],
  authors: [{ name: 'Sage Cinema' }],
  creator: 'Sage Cinema',
  robots: { index: true, follow: true },
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Sage Cinema',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#080a12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} scroll-smooth`}>
      <body>
        <ErrorBoundary>
          <AppProvider>
            <PwaRegister />
            <ScrollToTop />
            {children}
          </AppProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
