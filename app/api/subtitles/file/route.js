import { NextResponse } from 'next/server';
import { isValidMediaProxySignature } from '../../../../lib/unifiedSources';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const runtime = 'nodejs';

const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const SUBTITLE_TIMEOUT_MS = 10 * 1000;

function isPrivateAddress(address) {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 4) {
    const octets = normalized.split('.').map(Number);
    const [first, second] = octets;
    return first === 0 || first === 10 || first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 0) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 198 && second === 51) ||
      (first === 203 && second === 0) ||
      first >= 224;
  }
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('::ffff:');
}

async function assertPublicSubtitleUrl(url) {
  if (url.protocol !== 'https:') throw new Error('Unsupported subtitle protocol');
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
      hostname === 'metadata.google.internal' || isPrivateAddress(hostname)) {
    throw new Error('Private subtitle host is not allowed');
  }
  if (!isIP(hostname)) {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('Private subtitle host is not allowed');
  }
}

async function fetchSubtitle(url) {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const parsedUrl = new URL(currentUrl);
    await assertPublicSubtitleUrl(parsedUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SUBTITLE_TIMEOUT_MS);
    let upstream;
    try {
      upstream = await fetch(parsedUrl, {
        headers: {
          Accept: 'text/plain, text/vtt, application/x-subrip, */*',
          Origin: 'https://player.videasy.to',
          Referer: 'https://player.videasy.to/',
          'User-Agent': 'Mozilla/5.0 (Sage Cinema unified player)',
        },
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (![301, 302, 303, 307, 308].includes(upstream.status)) return upstream;
    const location = upstream.headers.get('location');
    if (!location) return upstream;
    currentUrl = new URL(location, parsedUrl).toString();
  }
  throw new Error('Too many subtitle redirects');
}

function toWebVtt(content) {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw new Error('Empty subtitle file');
  if (/^WEBVTT(?:\s|$)/i.test(normalized)) return `${normalized}\n`;

  const cues = normalized
    .replace(/^\d+\s*\n(?=\d{2}:\d{2}:\d{2}[,.]\d{3}\s+-->)/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  if (!/(?:^|\n)\d{2}:\d{2}:\d{2}\.\d{3}\s+-->/m.test(cues)) {
    throw new Error('Unsupported subtitle format');
  }
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

  try {
    await assertPublicSubtitleUrl(parsedUrl);
    const upstream = await fetchSubtitle(parsedUrl.toString());
    if (!upstream.ok) return new Response('Subtitle source unavailable', { status: upstream.status });
    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (contentLength > MAX_SUBTITLE_BYTES) return new Response('Subtitle file is too large', { status: 413 });
    const content = toWebVtt(await upstream.text());
    return new Response(content, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'Content-Type': 'text/vtt; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Unable to load subtitle source', { status: 502 });
  }
}
