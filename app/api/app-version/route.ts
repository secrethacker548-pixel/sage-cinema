import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // The APK is intentionally not bundled with the site for now. Return a URL only
  // when a release artifact has been configured, so the UI never advertises a 404.
  const apkUrl = process.env.ANDROID_APK_URL || process.env.NEXT_PUBLIC_ANDROID_APK_URL || null;

  return NextResponse.json({
    latest_version: '1.5.0',
    version_code: 25,
    download_url: apkUrl,
    direct_apk_url: apkUrl,
    release_notes:
      '• Android APK download is paused until a release URL is configured\n• Web site playback and Adsterra placements remain active',
    force_update: false,
  });
}
