import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Prefer an explicitly configured artifact URL; otherwise serve the APK bundled
  // in public/. Keeping this configurable avoids returning a stale same-origin URL
  // when deployments move the binary to object storage.
  const origin = request.nextUrl.origin;
  const apkUrl = process.env.ANDROID_APK_URL || process.env.NEXT_PUBLIC_ANDROID_APK_URL || `${origin}/sagemovies-latest.apk`;

  return NextResponse.json({
    latest_version: '1.5.0',
    version_code: 25,
    download_url: apkUrl,
    direct_apk_url: apkUrl,
    release_notes:
      '• Upgraded to Gradle 8.14, AGP 8.11.1, and Kotlin 2.2.20\n• Updated webview_flutter_wkwebview to 3.26.0\n• Fixed broken APK download link & updated dependencies',
    force_update: false,
  });
}
