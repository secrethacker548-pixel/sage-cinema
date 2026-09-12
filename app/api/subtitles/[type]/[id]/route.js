import { NextResponse } from 'next/server';
import { buildSubtitleProxyUrl } from '../../../../../lib/unifiedSources';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LANGUAGE_CODES = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'tl', 'ja', 'ko', 'zh', 'hi', 'ar']);
const SUBTITLE_CACHE_TTL_MS = 5 * 60 * 1000;
const SUBTITLE_CACHE_MAX_ENTRIES = 100;
const SUBTITLE_REQUEST_TIMEOUT_MS = 10 * 1000;

const subtitleCache = new Map();
const pendingSubtitleRequests = new Map();

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

function cacheKey({ type, id, title, year, season, episode, language }) {
  return [type, id, title || '', year || '', season || '', episode || '', language].join(':').toLowerCase();
}

function readCachedSubtitles(key) {
  const cached = subtitleCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt >= SUBTITLE_CACHE_TTL_MS) {
    subtitleCache.delete(key);
    return null;
  }
  return cached.subtitles;
}

function writeCachedSubtitles(key, subtitles) {
  if (subtitleCache.size >= SUBTITLE_CACHE_MAX_ENTRIES) {
    const oldestKey = subtitleCache.keys().next().value;
    if (oldestKey) subtitleCache.delete(oldestKey);
  }
  subtitleCache.set(key, { createdAt: Date.now(), subtitles });
}

function isSupportedSubtitleFile(file) {
  const value = [
    file.format,
    file.extension,
    file.ext,
    file.file_name,
    file.filename,
    file.name,
    file.url,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/\.(?:ass|ssa|sub|sup|idx|zip|rar|7z)(?:$|[?#\s])/i.test(value)) return false;
  return !/\.(?:jpg|jpeg|png|gif|mp3|mp4|mkv)(?:$|[?#\s])/i.test(value);
}

function isAllowedSubtitleUrl(url) {
  return url.protocol === 'https:' && (url.hostname === 'dl.subdl.com' || url.hostname.endsWith('.subdl.com'));
}

function subtitleResponse(subtitles, configured, message) {
  return NextResponse.json(
    { subtitles, configured, ...(message ? { message } : {}) },
    { headers: { 'Cache-Control': configured ? 'private, max-age=300' : 'private, no-store' } }
  );
}

async function fetchSubtitles({ apiKey, type, id, title, year, season, episode, requestedLanguage }) {
  const query = new URL('https://api.subdl.com/api/v1/subtitles');
  query.searchParams.set('api_key', apiKey);
  query.searchParams.set('tmdb_id', id);
  query.searchParams.set('type', type);
  query.searchParams.set('languages', requestedLanguage.toUpperCase());
  query.searchParams.set('unpack', '1');
  query.searchParams.set('subs_per_page', '30');
  query.searchParams.set('client', 'custom_integration');
  if (title) query.searchParams.set('film_name', title.slice(0, 200));
  if (year && /^\d{4}$/.test(year)) query.searchParams.set('year', year);
  if (type === 'tv' && season) query.searchParams.set('season_number', season);
  if (type === 'tv' && episode) query.searchParams.set('episode_number', episode);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUBTITLE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(query, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok || data.status === false) throw new Error('SubDL request failed');

    const subtitles = [];
    const seenUrls = new Set();
    (Array.isArray(data.subtitles) ? data.subtitles : []).forEach((subtitle, subtitleIndex) => {
      (Array.isArray(subtitle.unpack_files) ? subtitle.unpack_files : []).forEach((file, fileIndex) => {
        if (!file?.url || !isSupportedSubtitleFile(file)) return;

        let parsedUrl;
        try {
          parsedUrl = new URL(file.url, 'https://dl.subdl.com');
        } catch {
          return;
        }
        if (!isAllowedSubtitleUrl(parsedUrl)) return;

        const remoteUrl = parsedUrl.toString();
        if (seenUrls.has(remoteUrl)) return;
        seenUrls.add(remoteUrl);
        const lang = languageCode(file.language || subtitle.language, requestedLanguage);
        subtitles.push({
          id: `subdl-${file.file_n_id || `${subtitleIndex}-${fileIndex}`}`,
          lang,
          language: languageLabel(lang),
          url: buildSubtitleProxyUrl(remoteUrl),
        });
      });
    });
    return subtitles;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const { type, id } = resolvedParams;
  const { searchParams } = new URL(request.url);
  const apiKey = String(process.env.SUBDL_API_KEY || '').trim();

  const numericId = Number(id);
  if (!id || !['movie', 'tv'].includes(type) || !/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId < 1) {
    return NextResponse.json({ error: 'Invalid subtitle parameters' }, { status: 400 });
  }

  if (!apiKey) {
    return subtitleResponse([], false, 'Online caption search is not configured yet.');
  }

  const requestedLanguage = languageCode(searchParams.get('lang'), 'en');
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

  const key = cacheKey({ type, id, title, year, season, episode, language: requestedLanguage });
  const cachedSubtitles = readCachedSubtitles(key);
  if (cachedSubtitles) return subtitleResponse(cachedSubtitles, true);

  try {
    let requestPromise = pendingSubtitleRequests.get(key);
    if (!requestPromise) {
      requestPromise = fetchSubtitles({
        apiKey,
        type,
        id,
        title,
        year,
        season,
        episode,
        requestedLanguage,
      });
      pendingSubtitleRequests.set(key, requestPromise);
    }

    const subtitles = await requestPromise;
    writeCachedSubtitles(key, subtitles);
    return subtitleResponse(subtitles, true);
  } catch (error) {
    console.error('Online subtitle search error:', error);
    return subtitleResponse([], true, 'Online caption search is unavailable right now.');
  } finally {
    pendingSubtitleRequests.delete(key);
  }
}
