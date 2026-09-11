import { NextResponse } from 'next/server';
import { SEARCH_BRANDS } from '../../../lib/streamingServices';

export const revalidate = 300; // Revalidate search results every 5 minutes
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query')?.trim();
  const apiKey = process.env.TMDB_API_KEY;

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }
  if (query.length > 200) {
    return NextResponse.json({ error: 'Query is too long' }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const results = [];
    const queryLower = query.toLowerCase();

    const normalizedQuery = queryLower.trim().replace(/\s+/g, ' ');
    const platform = SEARCH_BRANDS.find((brand) => brand.aliases.includes(normalizedQuery))?.tmdb;

    // If query matches a platform, fetch from discover API too
    if (platform) {
      const movieFilter = platform.company
        ? `with_companies=${platform.company}`
        : `with_watch_providers=${platform.provider}&watch_region=US`;
      const tvFilter = platform.company
        ? `with_companies=${platform.company}`
        : `with_networks=${platform.network}`;

      const discoveryPromises = [];
      // Reduced from 3 pages to 2 pages for faster response
      for (let page = 1; page <= 2; page++) {
        discoveryPromises.push(
          fetchTMDB(
            `https://api.themoviedb.org/3/discover/movie?api_key=${apiKey}&${movieFilter}&sort_by=popularity.desc&page=${page}`
          ),
          fetchTMDB(
            `https://api.themoviedb.org/3/discover/tv?api_key=${apiKey}&${tvFilter}&sort_by=popularity.desc&page=${page}`
          )
        );
      }

      // Also add a general search for the platform name in titles just in case
      discoveryPromises.push(
        fetchTMDB(
          `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1`
        )
      );

      const discoveryResults = await Promise.all(discoveryPromises);

      discoveryResults.forEach((data) => {
        if (data.results) {
          data.results.forEach((item) => {
            // Determine media type if possible, discovery returns what you ask for
            // but we'll use a hint from the URL structure or data
            item.media_type = item.title ? 'movie' : 'tv';
            item.relevance_score = 110; // Highest priority for platform discovery
          });
          results.push(...data.results);
        }
      });
    }

    // Search movies (reduced to 2 pages for faster response)
    for (let page = 1; page <= 2; page++) {
      const data = await fetchTMDB(
        `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${page}`
      );
      if (data.results) {
        data.results.forEach((item) => {
          item.media_type = 'movie';
          item.relevance_score = calculateRelevance(item.title, query);
        });
        results.push(...data.results);
      }
    }

    // Search TV shows (reduced to 1 page for faster response)
    for (let page = 1; page <= 1; page++) {
      const tvData = await fetchTMDB(
        `https://api.themoviedb.org/3/search/tv?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=${page}`
      );
      if (tvData.results) {
        tvData.results.forEach((item) => {
          item.media_type = 'tv';
          item.relevance_score = calculateRelevance(item.name || '', query);
        });
        results.push(...tvData.results);
      }
    }

    const uniqueResults = Array.from(
      new Map(results.map((item) => [`${item.media_type || 'unknown'}:${item.id}`, item])).values()
    );
    uniqueResults.sort((a, b) => {
      if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
      return b.popularity - a.popularity;
    });

    return NextResponse.json(
      { results: uniqueResults },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'CDN-Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          // Netlify's CDN cache key ignores query strings unless told otherwise,
          // which served one query's results for every search. Netlify-Vary opts in.
          'Netlify-Vary': 'query',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ error: 'Failed to search TMDB' }, { status: 500 });
  }
}

async function fetchTMDB(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB returned ${response.status}`);
  return response.json();
}

function calculateRelevance(title, query) {
  const t = String(title || '').toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 90;
  const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b${escapedQuery}\\b`, 'i').test(t)) return 80;
  if (t.includes(q)) return 70;
  return 50;
}
