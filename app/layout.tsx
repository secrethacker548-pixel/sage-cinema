import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import { AppProvider } from '../lib/context/AppContext';

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
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body>
        <ErrorBoundary>
          <AppProvider>{children}</AppProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
