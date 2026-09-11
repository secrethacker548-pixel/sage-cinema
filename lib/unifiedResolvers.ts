export const UNIFIED_RESOLVERS = [
  { id: 'cdn', path: '/cdn/sources-with-title', label: 'CDN pool' },
  { id: 'vsrc', path: '/vsrc/sources-with-title', label: 'Stream pool' },
  { id: 'm4uhd', path: '/m4uhd/sources-with-title', label: 'HD pool' },
  { id: 'superflix', path: '/superflix/sources-with-title', label: 'Backup pool' },
];

export const DEFAULT_UNIFIED_RESOLVER = UNIFIED_RESOLVERS[0].id;
