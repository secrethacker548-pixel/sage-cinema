import { NextResponse } from 'next/server';
import { getPersistentStats, recordAnalyticsEvent } from '../../../lib/analyticsStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getPersistentStats(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('Analytics storage unavailable:', error);
    return NextResponse.json({ error: 'Analytics storage is not configured' }, { status: 503 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body?.type === 'visit') {
      return NextResponse.json(await recordAnalyticsEvent({ type: 'visit' }), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const movieId = String(body?.movieId ?? '');
    if (body?.type === 'movie_view' && /^\d+$/.test(movieId)) {
      return NextResponse.json(await recordAnalyticsEvent({ type: 'movie_view', movieId }), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return NextResponse.json({ error: 'Invalid analytics event' }, { status: 400 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid analytics event' }, { status: 400 });
    }
    console.error('Analytics storage unavailable:', error);
    return NextResponse.json({ error: 'Analytics storage is not configured' }, { status: 503 });
  }
}
