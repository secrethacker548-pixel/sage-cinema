import { isValidMediaProxySignature, buildMediaProxyUrl } from '../../../lib/unifiedSources';

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
  ['Accept-Ranges', 'Content-Range', 'ETag', 'Last-Modified'].forEach((header) => {
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
    const upstream = await fetch(parsedUrl, {
      headers: UPSTREAM_HEADERS,
      cache: 'no-store',
      redirect: 'follow',
    });
    const contentType = upstream.headers.get('content-type') || '';

    if (!upstream.ok) {
      return new Response(`Media source returned ${upstream.status}`, { status: upstream.status });
    }

    if (isPlaylist(parsedUrl.toString(), contentType)) {
      const content = await upstream.text();
      return new Response(rewritePlaylist(content, upstream.url || parsedUrl.toString(), Number(expires)), {
        status: 200,
        headers: responseHeaders(upstream, 'application/vnd.apple.mpegurl'),
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
