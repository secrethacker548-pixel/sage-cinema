import Link from 'next/link';
import { ArrowLeft, ExternalLink, ShieldCheck } from 'lucide-react';
import { CookieSettingsButton } from '../../components/CookieConsent';

export const metadata = {
  title: 'Privacy Policy',
  description: 'How Sage Cinema handles browser storage, analytics, advertising, and third-party services.',
};

export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <div className="privacy-shell">
        <header className="privacy-header">
          <Link className="privacy-brand" href="/" aria-label="Sage Cinema home">
            <span className="brand-orbit"><span /></span>
            <span>SAGE<span>CINEMA</span></span>
          </Link>
          <Link className="privacy-back" href="/"><ArrowLeft size={15} /> Back to cinema</Link>
        </header>

        <article className="privacy-card">
          <div className="privacy-hero">
            <span className="section-eyebrow"><ShieldCheck size={15} /> Privacy notice</span>
            <h1>Your privacy, clearly stated.</h1>
            <p>Last updated: September 10, 2026</p>
          </div>

          <div className="privacy-content">
            <section>
              <h2>Who we are</h2>
              <p>Sage Cinema is a movie and television discovery experience operated by phcodesage. This notice explains what information the site handles, why it is used, and which choices are available to you.</p>
            </section>

            <section>
              <h2>What we handle</h2>
              <ul>
                <li><strong>Necessary browser storage:</strong> watch history, watched episodes, playback position, the active player session, app-download preference, and your privacy choice. These are stored in your browser to provide the features you request.</li>
                <li><strong>Optional analytics:</strong> if you allow it, the site sends aggregate visit and movie-view events to its analytics endpoint. The current implementation does not ask you for an account, name, email address, or payment details.</li>
                <li><strong>Technical request data:</strong> hosting and service providers may receive ordinary request information such as an IP address, device, browser, and time of request in their server logs.</li>
              </ul>
            </section>

            <section>
              <h2>Why we use it</h2>
              <p>Necessary storage keeps the catalogue and player useful across visits. Optional analytics helps us understand which parts of the catalogue are being used and improve the experience. Optional advertising, when enabled and accepted, helps support the site.</p>
            </section>

            <section>
              <h2>Third-party services</h2>
              <ul>
                <li><strong>TMDB:</strong> catalogue metadata, artwork, ratings, and related discovery data.</li>
                <li><strong>Video and subtitle providers:</strong> selected playback sources and caption files may be requested when you start a screening or search for captions.</li>
                <li><strong>Advertising providers:</strong> optional Adsterra scripts or sponsored placements may load only after advertising consent when the feature is enabled.</li>
                <li><strong>Analytics storage:</strong> optional aggregate counters are stored in the site’s configured server-side Redis provider so they can survive serverless requests and deployments.</li>
                <li><strong>External links:</strong> social profiles, Buy Me a Coffee, YouTube trailers, and other links are governed by those services’ own policies when you visit them.</li>
              </ul>
            </section>

            <section>
              <h2>Cookies and similar technologies</h2>
              <p>Sage Cinema currently uses local storage and session storage rather than requiring a first-party cookie for its core features. Necessary storage is used for functionality. Optional analytics and advertising are disabled until you choose to allow them. You can change that choice at any time with the button below or from the consent prompt.</p>
              <CookieSettingsButton />
            </section>

            <section>
              <h2>Retention and security</h2>
              <p>Browser-held data remains until you clear it or remove the site’s storage. Optional aggregate counters are retained in the configured server-side analytics store while the service is operating; they are not intended to identify individual visitors. We use reasonable technical measures, but no internet service can guarantee absolute security.</p>
            </section>

            <section>
              <h2>Your choices and rights</h2>
              <p>You can decline optional analytics and advertising, clear Sage Cinema storage through your browser settings, and stop using external services by leaving their sites. Depending on where you live, you may also have rights to access, correct, delete, object to, or restrict the processing of personal information. To ask a privacy question, contact <a href="https://github.com/phcodesage" target="_blank" rel="noreferrer">phcodesage on GitHub <ExternalLink size={13} /></a>.</p>
            </section>

            <section>
              <h2>Changes to this notice</h2>
              <p>When the site’s data practices change, this page will be updated with a new date. Material changes may be presented through the consent prompt where appropriate.</p>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
