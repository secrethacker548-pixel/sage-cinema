import { NextResponse } from 'next/server';
import { getServer, DEFAULT_LANG, SUBTITLE_LANGUAGES } from '../../../../../lib/videoServers';
import {
  resolveUnifiedSources,
} from '../../../../../lib/unifiedSources';
import { DEFAULT_UNIFIED_RESOLVER, UNIFIED_RESOLVERS } from '../../../../../lib/unifiedResolvers';

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const { type, id } = resolvedParams;
  const { searchParams } = new URL(request.url);

  const numericId = Number(id);
  if (!type || !id || !['movie', 'tv'].includes(type) || !/^\d+$/.test(id) || !Number.isSafeInteger(numericId) || numericId < 1) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const useUnifiedPlayer = searchParams.get('player') === 'unified';
  const requestedServer = searchParams.get('server');
  const unifiedResolver = UNIFIED_RESOLVERS.some((resolver) => resolver.id === requestedServer)
    ? requestedServer
    : DEFAULT_UNIFIED_RESOLVER;
  const server = getServer(requestedServer);

  const requestedLang = searchParams.get('lang') || DEFAULT_LANG;
  const lang = SUBTITLE_LANGUAGES.some((l) => l.code === requestedLang)
    ? requestedLang
    : DEFAULT_LANG;

  const season = parseInt(searchParams.get('season') || '1', 10) || 1;
  const episode = parseInt(searchParams.get('episode') || '1', 10) || 1;
  if (season < 1 || episode < 1) {
    return NextResponse.json({ error: 'Invalid season or episode' }, { status: 400 });
  }

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
        title: (searchParams.get('title') || '').slice(0, 200),
        year: /^\d{4}$/.test(searchParams.get('year') || '') ? searchParams.get('year') : undefined,
        totalSeasons: parseInt(searchParams.get('totalSeasons') || '0', 10) || undefined,
        season,
        episode,
        resolverId: unifiedResolver,
      });

      return NextResponse.json({
        player: 'unified',
        sources: unified.sources,
        subtitles: unified.subtitles,
        server: unifiedResolver,
        langApplied: lang,
      });
    } catch (error) {
      console.error('Unified source error:', error);
      return NextResponse.json({
        player: 'unavailable',
        sources: [],
        server: unifiedResolver,
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
