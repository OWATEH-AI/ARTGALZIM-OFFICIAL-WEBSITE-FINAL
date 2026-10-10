const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'youtu.be']);

export function formatTvDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration <= 0) return '';
  const totalSeconds = Math.floor(duration);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${totalMinutes}:${seconds}`;
}

export function getTvVideoDuration(entry) {
  const savedDuration = String(entry?.duration || '').trim();
  return savedDuration || formatTvDuration(entry?.durationSeconds);
}

export function getTvVideoSourceUrl(entry) {
  const fileUrl = entry?.fileUrl || entry?.attachmentUrl || '';
  const candidate = fileUrl || entry?.mediaUrl || '';
  if (!candidate) return '';
  try {
    const url = new URL(candidate, 'https://artgalzim.com');
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    const looksLikeVideo = /\.(mp4|webm|ogv|ogg|mov|m4v|m3u8)$/i.test(url.pathname)
      || /\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(entry?.attachmentName || '');
    return isHttp && looksLikeVideo ? (candidate.startsWith('/') ? candidate : url.href) : '';
  } catch {
    return '';
  }
}

export function getTvThumbnailCandidates(entry) {
  const candidates = [entry?.imageUrl, entry?.posterUrl].filter(Boolean);
  const mediaUrl = entry?.mediaUrl || '';
  try {
    const url = new URL(mediaUrl);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol === 'https:' && YOUTUBE_HOSTS.has(host)) {
      const segments = url.pathname.split('/').filter(Boolean);
      const videoId = host === 'youtu.be'
        ? segments[0]
        : url.searchParams.get('v') || (['shorts', 'embed', 'live'].includes(segments[0]) ? segments[1] : '');
      if (videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId)) {
        candidates.push(
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          `https://i.ytimg.com/vi/${videoId}/default.jpg`
        );
      }
    }
  } catch {}

  return [...new Set(candidates.map(value => {
    const source = String(value).trim();
    if (source.startsWith('/')) return source;
    try {
      const url = new URL(source);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }).filter(Boolean))];
}

export function getTvVideoOrientation(entry) {
  if (!entry) return 'landscape';
  if (entry.location === 'shorts' || entry.location === 'portrait') return 'portrait';
  if (entry.location === 'fullscreen' || entry.location === 'landscape') return 'landscape';
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
  return (entries || []).reduce((groups, entry) => {
    groups[getTvVideoOrientation(entry) === 'portrait' ? 'shorts' : 'landscape'].push(entry);
    return groups;
  }, { landscape: [], shorts: [] });
}
