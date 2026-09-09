import { NextResponse } from 'next/server';
import { isValidMediaProxySignature } from '../../../../lib/unifiedSources';

export const runtime = 'nodejs';

const SUBTITLE_HOST = 'dl.subdl.com';

function toWebVtt(content) {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (/^WEBVTT(?:\s|$)/i.test(normalized)) return `${normalized}\n`;

  const cues = normalized
    .replace(/^(\d+)\s*\n(?=\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->)/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${cues}\n`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const remoteUrl = searchParams.get('url') || '';
  const expires = searchParams.get('expires') || '';
  const signature = searchParams.get('sig') || '';

  if (!isValidMediaProxySignature(remoteUrl, expires, signature)) {
    return new Response('Invalid or expired subtitle URL', { status: 403 });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(remoteUrl);
  } catch {
    return new Response('Invalid subtitle URL', { status: 400 });
  }

  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== SUBTITLE_HOST) {
    return new Response('Unsupported subtitle source', { status: 400 });
  }

  try {
    const upstream = await fetch(parsedUrl, { headers: { Accept: 'text/plain, text/vtt, */*' }, cache: 'no-store' });
    if (!upstream.ok) return new Response('Subtitle source unavailable', { status: upstream.status });
    const content = toWebVtt(await upstream.text());
    return new Response(content, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/vtt; charset=utf-8',
      },
    });
  } catch {
    return new Response('Unable to load subtitle source', { status: 502 });
  }
}
