import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') === 'tv' ? 'tv' : 'movie';
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    // Fetch titles from the same production company
    const response = await fetch(
      `https://api.themoviedb.org/3/discover/${type}?api_key=${apiKey}&with_companies=${id}&sort_by=popularity.desc&page=1`,
      { next: { revalidate: 3600 } }
    );
    const data = await response.json();

    if (data.results) {
      data.results.forEach(item => item.media_type = type);
    }

    return NextResponse.json({
      results: data.results || [],
      page: 1,
      hasMore: false
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch movies by studio' }, { status: 500 });
  }
}
