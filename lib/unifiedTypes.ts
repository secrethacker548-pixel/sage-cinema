export interface UnifiedSource {
  id: string;
  label: string;
  quality: string;
  type: 'hls' | 'mp4' | 'dash' | 'unknown';
  playbackUrl: string;
  provider: string;
}

export interface UnifiedSubtitle {
  id: string;
  lang: string;
  language: string;
  url: string;
}
