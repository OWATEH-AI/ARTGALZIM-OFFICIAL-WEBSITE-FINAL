const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'youtu.be']);

export function getTvVideoOrientation(entry) {
  if (entry.videoOrientation === 'portrait' || entry.videoOrientation === 'landscape') {
    return entry.videoOrientation;
  }

  try {
    const url = new URL(entry.mediaUrl || '');
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol === 'https:' && YOUTUBE_HOSTS.has(host) && /^\/shorts\//.test(url.pathname)) {
      return 'portrait';
    }
  } catch {
    return 'landscape';
  }

  return 'landscape';
}

export function groupTvVideos(entries) {
  return entries.reduce((groups, entry) => {
    groups[getTvVideoOrientation(entry) === 'portrait' ? 'shorts' : 'landscape'].push(entry);
    return groups;
  }, { landscape: [], shorts: [] });
}
