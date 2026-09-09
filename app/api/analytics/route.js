import { NextResponse } from 'next/server';

const STATS_KEY = Symbol.for('sage-cinema.analytics.stats');

function getStats() {
  if (!globalThis[STATS_KEY]) {
    globalThis[STATS_KEY] = {
      totalVisits: 0,
      movieViews: {},
    };
  }

  return globalThis[STATS_KEY];
}

function snapshot() {
  const stats = getStats();
  return {
    totalVisits: stats.totalVisits,
    movieViews: { ...stats.movieViews },
  };
}

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(snapshot(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const stats = getStats();

    if (body?.type === 'visit') {
      stats.totalVisits += 1;
    }

    if (body?.type === 'movie_view' && body.movieId !== undefined) {
      const movieId = String(body.movieId);
      stats.movieViews[movieId] = (stats.movieViews[movieId] || 0) + 1;
    }

    return NextResponse.json(snapshot(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid analytics event' }, { status: 400 });
  }
}
