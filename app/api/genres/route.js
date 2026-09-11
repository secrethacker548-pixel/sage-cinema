import { NextResponse } from 'next/server';

export const revalidate = 86400; // Revalidate every 24 hours (genres rarely change)
export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/genre/movie/list?api_key=${apiKey}`,
      { next: { revalidate: 86400 } }
    );
    if (!response.ok) throw new Error(`TMDB returned ${response.status}`);
    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
        'CDN-Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=172800',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch genres' }, { status: 500 });
  }
}
