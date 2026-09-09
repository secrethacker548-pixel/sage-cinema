import './globals.css';
import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import PwaRegister from '../components/PwaRegister';
import ScrollToTop from '../components/ScrollToTop';
import { AppProvider } from '../lib/context/AppContext';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900'],
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
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: ['/favicon.ico'],
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
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
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
