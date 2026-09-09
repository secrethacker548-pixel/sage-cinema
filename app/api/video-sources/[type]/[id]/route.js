import { NextResponse } from 'next/server';
import { getServer, DEFAULT_LANG, SUBTITLE_LANGUAGES } from '../../../../../lib/videoServers';
import { resolveUnifiedSources } from '../../../../../lib/unifiedSources';

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const { type, id } = resolvedParams;
  const { searchParams } = new URL(request.url);

  if (!type || !id || !['movie', 'tv'].includes(type)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const server = getServer(searchParams.get('server'));

  const requestedLang = searchParams.get('lang') || DEFAULT_LANG;
  const lang = SUBTITLE_LANGUAGES.some((l) => l.code === requestedLang)
    ? requestedLang
    : DEFAULT_LANG;

  const season = parseInt(searchParams.get('season') || '1', 10) || 1;
  const episode = parseInt(searchParams.get('episode') || '1', 10) || 1;
  const useUnifiedPlayer = searchParams.get('player') === 'unified';

  const embedURL = server.build(type, id, {
    lang: server.supportsLang ? lang : undefined,
    season,
    episode,
  });

  if (useUnifiedPlayer) {
    try {
      const unified = await resolveUnifiedSources({
        type,
        id,
        title: searchParams.get('title') || '',
        year: searchParams.get('year') || undefined,
        totalSeasons: parseInt(searchParams.get('totalSeasons') || '0', 10) || undefined,
        season,
        episode,
      });

      return NextResponse.json({
        player: 'unified',
        sources: unified.sources,
        subtitles: unified.subtitles,
        server: server.id,
        fallbackEmbedURL: embedURL,
        langApplied: server.supportsLang ? lang : null,
      });
    } catch (error) {
      console.error('Unified source error:', error);
      return NextResponse.json({
        player: 'unavailable',
        sources: [],
        server: server.id,
        fallbackEmbedURL: embedURL,
        error: 'A clean playback source is not available yet.',
      });
    }
  }

  return NextResponse.json({
    embedURL,
    server: server.id,
    // The UI reads this to tell the user when the language picker has no effect
    // on the provider they selected.
    langApplied: server.supportsLang ? lang : null,
  });
}
