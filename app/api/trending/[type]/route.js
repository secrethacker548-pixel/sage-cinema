import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const { type } = resolvedParams;
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || '1');
  const apiKey = process.env.TMDB_API_KEY;

  if (!['movie', 'tv', 'all'].includes(type)) {
    return NextResponse.json({ error: 'Invalid trending type' }, { status: 400 });
  }
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  if (!Number.isInteger(page) || page < 1 || page > 50) {
    return NextResponse.json({ error: 'Invalid page' }, { status: 400 });
  }

  try {
    const results = [];
    
    // Fetch two pages beginning at the requested page.
    for (let currentPage = page; currentPage <= page + 1; currentPage++) {
      const response = await fetch(
        `https://api.themoviedb.org/3/trending/${type}/week?api_key=${apiKey}&page=${currentPage}`,
        { next: { revalidate: 3600 } } // Cache for 1 hour
      );
      if (!response.ok) throw new Error(`TMDB returned ${response.status}`);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        results.push(...data.results);
      }
    }
    
    if (type === 'movie') {
      const popularResponse = await fetch(
        `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&page=1`,
        { next: { revalidate: 3600 } }
      );
      if (!popularResponse.ok) throw new Error(`TMDB returned ${popularResponse.status}`);
      const popularData = await popularResponse.json();
      if (popularData.results) {
        popularData.results.forEach(item => item.media_type = 'movie');
        results.push(...popularData.results);
      }
    }
    
    if (type === 'tv') {
      const popularResponse = await fetch(
        `https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&page=1`,
        { next: { revalidate: 3600 } }
      );
      if (!popularResponse.ok) throw new Error(`TMDB returned ${popularResponse.status}`);
      const popularData = await popularResponse.json();
      if (popularData.results) {
        popularData.results.forEach(item => item.media_type = 'tv');
        results.push(...popularData.results);
      }
    }
    
    const uniqueResults = Array.from(new Map(results.map(item => [`${item.media_type || type}:${item.id}`, item])).values());
    uniqueResults.sort((a, b) => b.popularity - a.popularity);
    
    return NextResponse.json({ results: uniqueResults });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}
