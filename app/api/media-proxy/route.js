import { isValidMediaProxySignature, buildMediaProxyUrl } from '../../../lib/unifiedSources';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const runtime = 'nodejs';

const UPSTREAM_HEADERS = {
  Accept: '*/*',
  Origin: 'https://player.videasy.to',
  Referer: 'https://player.videasy.to/',
  'User-Agent': 'Mozilla/5.0 (Sage Cinema unified player)',
};

function isPlaylist(url, contentType = '') {
  return url.toLowerCase().includes('.m3u8') || /mpegurl|vnd\.apple\.mpegurl/i.test(contentType);
}

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

async function assertPublicUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Unsupported media protocol');
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') ||
      hostname === 'metadata.google.internal' || isPrivateAddress(hostname)) {
    throw new Error('Private media host is not allowed');
  }

  if (!isIP(hostname)) {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error('Private media host is not allowed');
    }
  }
}

async function fetchPublicUrl(url, options) {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    await assertPublicUrl(currentUrl);
    const response = await fetch(currentUrl, { ...options, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error('Too many media redirects');
}

function rewritePlaylist(content, sourceUrl, expires) {
  const rewrite = (value) => {
    if (!value || value.startsWith('#') || value.startsWith('data:')) return value;
    return buildMediaProxyUrl(new URL(value, sourceUrl).toString(), expires);
  };

  return content
    .split('\n')
    .map((line) => {
      const uriRewritten = line.replace(/URI="([^"]+)"/g, (_, value) => `URI="${rewrite(value)}"`);
      return uriRewritten.startsWith('#') ? uriRewritten : rewrite(uriRewritten.trim());
    })
    .join('\n');
}

function responseHeaders(response, contentType) {
  const headers = new Headers();
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Type', contentType || 'application/octet-stream');
  ['Accept-Ranges', 'Content-Length', 'Content-Range', 'ETag', 'Last-Modified'].forEach((header) => {
    const value = response.headers.get(header);
    if (value) headers.set(header, value);
  });
  return headers;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const remoteUrl = searchParams.get('url') || '';
  const expires = searchParams.get('expires') || '';
  const signature = searchParams.get('sig') || '';

  if (!isValidMediaProxySignature(remoteUrl, expires, signature)) {
    return new Response('Invalid or expired media URL', { status: 403 });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(remoteUrl);
  } catch {
    return new Response('Invalid media URL', { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return new Response('Unsupported media protocol', { status: 400 });
  }

  try {
    const range = request.headers.get('range');
    const upstreamHeaders = { ...UPSTREAM_HEADERS };
    if (range) upstreamHeaders.Range = range;

    const upstream = await fetchPublicUrl(parsedUrl.toString(), {
      headers: upstreamHeaders,
      cache: 'no-store',
    });
    const contentType = upstream.headers.get('content-type') || '';

    if (!upstream.ok) {
      return new Response(`Media source returned ${upstream.status}`, { status: upstream.status });
    }

    if (isPlaylist(parsedUrl.toString(), contentType)) {
      const content = await upstream.text();
      const headers = responseHeaders(upstream, 'application/vnd.apple.mpegurl');
      // The body is rewritten, so the upstream byte count is no longer valid.
      headers.delete('Content-Length');
      return new Response(rewritePlaylist(content, upstream.url || parsedUrl.toString(), Number(expires)), {
        status: 200,
        headers,
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders(upstream, contentType),
    });
  } catch (error) {
    console.error('Media proxy error:', error);
    return new Response('Unable to load media source', { status: 502 });
  }
}
