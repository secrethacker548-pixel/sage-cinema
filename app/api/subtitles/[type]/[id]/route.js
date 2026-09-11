import { NextResponse } from 'next/server';
import { buildSubtitleProxyUrl } from '../../../../../lib/unifiedSources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LANGUAGE_CODES = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'tl', 'ja', 'ko', 'zh', 'hi', 'ar']);

function languageLabel(value) {
  const normalized = String(value || '').trim().toUpperCase();
  const labels = {
    EN: 'English',
    ES: 'Spanish',
    FR: 'French',
    DE: 'German',
    IT: 'Italian',
    PT: 'Portuguese',
    TL: 'Tagalog',
    JA: 'Japanese',
    KO: 'Korean',
    ZH: 'Chinese',
    HI: 'Hindi',
    AR: 'Arabic',
  };
  return labels[normalized] || normalized || 'Captions';
}

function languageCode(value, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return LANGUAGE_CODES.has(normalized) ? normalized : fallback;
}

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const { type, id } = resolvedParams;
  const { searchParams } = new URL(request.url);
  const apiKey = process.env.SUBDL_API_KEY;

  const numericId = Number(id);
  if (!id || !['movie', 'tv'].includes(type) || !/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId < 1) {
    return NextResponse.json({ error: 'Invalid subtitle parameters' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ subtitles: [], configured: false, message: 'Online caption search is not configured yet.' });
  }

  const requestedLanguage = languageCode(searchParams.get('lang'), 'en');
  const query = new URL('https://api.subdl.com/api/v1/subtitles');
  query.searchParams.set('api_key', apiKey);
  query.searchParams.set('tmdb_id', id);
  query.searchParams.set('type', type);
  query.searchParams.set('languages', requestedLanguage.toUpperCase());
  query.searchParams.set('unpack', '1');
  query.searchParams.set('subs_per_page', '30');
  query.searchParams.set('client', 'custom_integration');

  const title = searchParams.get('title');
  const year = searchParams.get('year');
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');
  if (season && (!/^\d+$/.test(season) || Number(season) < 1)) {
    return NextResponse.json({ error: 'Invalid season' }, { status: 400 });
  }
  if (episode && (!/^\d+$/.test(episode) || Number(episode) < 1)) {
    return NextResponse.json({ error: 'Invalid episode' }, { status: 400 });
  }
  if (title) query.searchParams.set('film_name', title.slice(0, 200));
  if (year && /^\d{4}$/.test(year)) query.searchParams.set('year', year);
  if (type === 'tv' && season) query.searchParams.set('season_number', season);
  if (type === 'tv' && episode) query.searchParams.set('episode_number', episode);

  try {
    const response = await fetch(query, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const data = await response.json();
    if (!response.ok || data.status === false) {
      return NextResponse.json({ subtitles: [], configured: true, message: 'Online caption search is unavailable right now.' });
    }

    const subtitles = [];
    (data.subtitles || []).forEach((subtitle, subtitleIndex) => {
      (subtitle.unpack_files || []).forEach((file, fileIndex) => {
        if (!file.url) return;
        const remoteUrl = new URL(file.url, 'https://dl.subdl.com').toString();
        const lang = languageCode(file.language || subtitle.language, requestedLanguage);
        subtitles.push({
          id: `subdl-${file.file_n_id || `${subtitleIndex}-${fileIndex}`}`,
          lang,
          language: languageLabel(lang),
          url: buildSubtitleProxyUrl(remoteUrl),
        });
      });
    });

    return NextResponse.json({ subtitles, configured: true });
  } catch (error) {
    console.error('Online subtitle search error:', error);
    return NextResponse.json({ subtitles: [], configured: true, message: 'Online caption search is unavailable right now.' });
  }
}
