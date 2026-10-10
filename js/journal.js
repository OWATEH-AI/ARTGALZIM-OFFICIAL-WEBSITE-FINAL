import {
  formatTvDuration,
  getTvThumbnailCandidates,
  getTvVideoDuration,
  getTvVideoOrientation,
  getTvVideoSourceUrl,
  groupTvVideos,
  isTvSystemFolder
} from './tv-layout.js';

const feed = document.getElementById('journalFeed');
let journalFolders = [];
let journalEntries = [];
let legacyEntries = [];
let currentFolderId = null;
let currentEntryId = null;
let currentJournalTab = 'journal';
let pendingTvAutoplayEntryId = null;
let pendingFolderLoadId = null;
let folderLoadingTimer = null;
let galleryHistoryDepth = 0;
let folderPreloaderActive = false;
let activeVideoDownloadCountdown = null;

function showFolderPreloader() {
  const preloader = document.getElementById('preloader');
  if (!preloader) throw new Error('The shared page preloader is missing.');
  preloader.classList.remove('hidden');
  const fill = preloader.querySelector('.preloader-fill');
  if (fill) fill.replaceWith(fill.cloneNode(true));
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  folderPreloaderActive = true;
}

function hideFolderPreloader() {
  if (!folderPreloaderActive) return;
  document.getElementById('preloader')?.classList.add('hidden');
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  folderPreloaderActive = false;
}

function isTvEntry(entry) {
  return entry.destination === 'tv' || (!entry.destination && entry.entryType === 'ARTGALZIM TV');
}

function safeMediaUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function addText(parent, tagName, text, className = '') {
  const element = document.createElement(tagName);
  element.textContent = text || '';
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function safeRichHref(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value, window.location.href);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function appendSafeRichContent(parent, value) {
  const parsed = new DOMParser().parseFromString(String(value || ''), 'text/html');
  const allowed = new Set(['A', 'B', 'BLOCKQUOTE', 'BR', 'EM', 'H2', 'H3', 'H4', 'HR', 'I', 'LI', 'MARK', 'OL', 'P', 'STRONG', 'U', 'UL']);
  const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH']);
  const appendSafe = (node, target) => {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(node.textContent || ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || blocked.has(node.tagName)) return;
    if (!allowed.has(node.tagName)) {
      node.childNodes.forEach(child => appendSafe(child, target));
      return;
    }
    const element = document.createElement(node.tagName.toLowerCase());
    if (node.tagName === 'A') {
      const href = safeRichHref(node.getAttribute('href'));
      if (href) {
        element.href = href;
        element.target = '_blank';
        element.rel = 'noopener noreferrer';
      }
    }
    node.childNodes.forEach(child => appendSafe(child, element));
    target.appendChild(element);
  };
  parsed.body.childNodes.forEach(node => appendSafe(node, parent));
}

function addButton(parent, text, onClick, className = 'journal-button') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.addEventListener('click', onClick);
  parent.appendChild(button);
  return button;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function addEntryMetadata(parent, entry) {
  const fields = [
    ['Artist / Curator', entry.artistCurator],
    ['Category', entry.category],
    ['Description', entry.excerpt],
    ['School', entry.location],
    ['Author / Reporter', entry.author]
  ].filter(([, value]) => typeof value === 'string' && value.trim());
  if (!fields.length) return;
  const metadata = document.createElement('dl');
  metadata.className = 'journal-entry-metadata';
  for (const [label, value] of fields) {
    addText(metadata, 'dt', label);
    addText(metadata, 'dd', value.trim());
  }
  parent.appendChild(metadata);
}

function youtubeVideoId(url, host) {
  const segments = url.pathname.split('/').filter(Boolean);
  const videoId = host === 'youtu.be'
    ? segments[0]
    : url.searchParams.get('v') || (['shorts', 'embed', 'live'].includes(segments[0]) ? segments[1] : '');
  return videoId && /^[A-Za-z0-9_-]{6,}$/.test(videoId) ? videoId : '';
}

function mediaEmbed(mediaUrl, mediaType, directVideoAsset = false) {
  let url;
  try {
    url = new URL(mediaUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (mediaType === 'video' && ['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
    const videoId = youtubeVideoId(url, host);
    return videoId ? {
      kind: 'youtube',
      src: `https://www.youtube-nocookie.com/embed/${videoId}`,
      thumbnails: [
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        `https://i.ytimg.com/vi/${videoId}/default.jpg`
      ]
    } : null;
  }
  if (mediaType === 'video' && directVideoAsset) return { kind: 'video', src: url.href };
  if (mediaType === 'video' && /\.(mp4|webm|ogv|m3u8)$/i.test(url.pathname)) {
    return { kind: 'video', src: url.href };
  }
  if (mediaType === 'document' && ['drive.google.com', 'docs.google.com'].includes(host)) {
    const match = url.pathname.match(/\/(file|document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/);
    const fileId = match?.[2] || url.searchParams.get('id');
    const documentType = match?.[1] || 'file';
    const embedHost = documentType === 'file' ? 'drive.google.com' : 'docs.google.com';
    const embedPath = documentType === 'file' ? 'file' : documentType;
    return fileId ? { kind: 'frame', src: `https://${embedHost}/${embedPath}/d/${fileId}/preview` } : null;
  }
  if (mediaType === 'document' && /\.pdf$/i.test(url.pathname)) {
    return { kind: 'frame', src: url.href };
  }
  if (mediaType === 'social' && host === 'instagram.com') {
    const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?/);
    return match ? { kind: 'frame', src: `https://www.instagram.com/${match[1]}/${match[2]}/embed/` } : null;
  }
  return null;
}

function formatVideoTime(seconds) {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function getSanityVideoDownload(entry) {
  const id = String(entry?._id || '');
  const source = entry?.fileUrl || entry?.attachmentUrl || entry?.mediaUrl || '';
  try {
    const url = new URL(source, window.location.href);
    if (url.protocol !== 'https:' || url.hostname !== 'cdn.sanity.io' || !url.pathname.startsWith('/files/')) {
      return { url: '', size: 0 };
    }
    return {
      url: `/api/video-download?id=${encodeURIComponent(id)}`,
      size: Number(entry.attachmentSize) || 0
    };
  } catch {
    return { url: '', size: 0 };
  }
}

function videoDownloadWaitSeconds(size) {
  return Math.min(10, Math.max(3, 2 + Math.ceil((Number(size) || 0) / (25 * 1024 * 1024))));
}

function showVideoDownloadStatus(size) {
  if (activeVideoDownloadCountdown) return;

  const notice = document.createElement('div');
  notice.className = 'ag-download-status';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  const message = document.createElement('span');
  notice.appendChild(message);
  document.body.appendChild(notice);

  let remaining = videoDownloadWaitSeconds(size);
  const updateMessage = () => {
    message.textContent = remaining > 0
      ? `Preparing your download. Starting in ${remaining} second${remaining === 1 ? '' : 's'}...`
      : 'Your download has begun.';
  };
  updateMessage();
  const timer = window.setInterval(() => {
    remaining -= 1;
    updateMessage();
    if (remaining > 0) return;
    window.clearInterval(timer);
    activeVideoDownloadCountdown = null;
    window.setTimeout(() => notice.remove(), 12000);
  }, 1000);
  activeVideoDownloadCountdown = { notice, timer };
}

function createPremiumVideoPlayer({
  videoUrl,
  downloadUrl = '',
  downloadSize = 0,
  posterUrl = '',
  title = '',
  prevVideo = null,
  nextVideo = null,
  onNavigate = null,
  autoplay = false,
  muted = false
}) {
  const container = document.createElement('div');
  container.className = 'ag-tv-player-box ag-premium-player';
  container.tabIndex = 0;

  const video = document.createElement('video');
  video.src = safeMediaUrl(videoUrl);
  if (posterUrl) video.poster = safeMediaUrl(posterUrl);
  video.playsInline = true;
  video.autoplay = autoplay;
  video.muted = muted;
  video.preload = 'metadata';
  video.controls = false;

  const overlay = document.createElement('div');
  overlay.className = 'ag-player-overlay';

  const bigPlay = document.createElement('button');
  bigPlay.type = 'button';
  bigPlay.className = 'ag-player-big-play';
  bigPlay.setAttribute('aria-label', 'Play');
  bigPlay.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;

  const topBar = document.createElement('div');
  topBar.className = 'ag-player-top-bar';

  const minimizeBtn = document.createElement('button');
  minimizeBtn.type = 'button';
  minimizeBtn.className = 'ag-player-minimize-btn';
  minimizeBtn.setAttribute('aria-label', 'Exit Fullscreen');
  minimizeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg> <span>Minimize</span>`;
  topBar.appendChild(minimizeBtn);

  const popover = document.createElement('div');
  popover.className = 'ag-player-menu-popover';

  const speedHeader = document.createElement('div');
  speedHeader.style.cssText = 'padding: 4px 8px 3px; font-size: 0.72rem; color: var(--gold); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;';
  speedHeader.textContent = 'Playback Speed';
  popover.appendChild(speedHeader);

  const speedGrid = document.createElement('div');
  speedGrid.className = 'ag-speed-chips';
  const speedRates = [0.5, 0.75, 1, 1.25, 1.5, 2];
  speedRates.forEach(rate => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `ag-speed-chip${rate === 1 ? ' is-active' : ''}`;
    chip.textContent = rate === 1 ? '1x' : `${rate}x`;
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      video.playbackRate = rate;
      speedGrid.querySelectorAll('.ag-speed-chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      popover.classList.remove('is-open');
    });
    speedGrid.appendChild(chip);
  });
  popover.appendChild(speedGrid);

  const downloadItem = document.createElement('a');
  downloadItem.className = 'ag-menu-item';
  downloadItem.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg><span class="ag-menu-item-text">Download Video</span>`;
  let isSanityCdnVideo = false;
  try {
    isSanityCdnVideo = new URL(videoUrl, window.location.href).hostname === 'cdn.sanity.io';
  } catch {}
  const resolvedDownloadUrl = downloadUrl
    ? safeMediaUrl(downloadUrl)
    : (isSanityCdnVideo ? '' : safeMediaUrl(videoUrl));
  downloadItem.href = resolvedDownloadUrl || '#';
  downloadItem.download = '';
  if (!downloadUrl) {
    downloadItem.target = '_blank';
    downloadItem.rel = 'noopener noreferrer';
  }
  downloadItem.hidden = !resolvedDownloadUrl;
  downloadItem.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!resolvedDownloadUrl) {
      e.preventDefault();
      return;
    }
    if (downloadUrl) {
      showVideoDownloadStatus(downloadSize);
      popover.classList.remove('is-open');
    } else {
      const cleanName = (title || 'artgalzim-video').replace(/[^a-z0-9_-]/gi, '_');
      downloadItem.download = cleanName.endsWith('.mp4') ? cleanName : `${cleanName}.mp4`;
    }
  });
  popover.appendChild(downloadItem);

  if (document.pictureInPictureEnabled) {
    const pipItem = document.createElement('button');
    pipItem.type = 'button';
    pipItem.className = 'ag-menu-item';
    pipItem.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/></svg><span class="ag-menu-item-text">Picture in Picture</span>`;
    pipItem.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await video.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('PiP error', err);
      }
      popover.classList.remove('is-open');
    });
    popover.appendChild(pipItem);
  }

  const controls = document.createElement('div');
  controls.className = 'ag-player-controls';

  const timeline = document.createElement('div');
  timeline.className = 'ag-player-timeline';

  const tooltip = document.createElement('div');
  tooltip.className = 'ag-timeline-tooltip';
  tooltip.textContent = '0:00';

  const track = document.createElement('div');
  track.className = 'ag-timeline-track';

  const bufferBar = document.createElement('div');
  bufferBar.className = 'ag-timeline-buffer';

  const progressBar = document.createElement('div');
  progressBar.className = 'ag-timeline-progress';

  const thumb = document.createElement('div');
  thumb.className = 'ag-timeline-thumb';

  track.append(bufferBar, progressBar, thumb);
  timeline.append(tooltip, track);
  controls.appendChild(timeline);

  const controlsRow = document.createElement('div');
  controlsRow.className = 'ag-player-controls-row';

  const leftGroup = document.createElement('div');
  leftGroup.className = 'ag-controls-group';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'ag-player-btn ag-btn-prev';
  const prevTitle = prevVideo ? `Previous: ${prevVideo.title || 'Video'}` : 'Rewind 10s';
  prevBtn.setAttribute('aria-label', prevTitle);
  prevBtn.title = prevTitle;
  prevBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>`;
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (prevVideo && onNavigate) {
      onNavigate(prevVideo);
    } else {
      video.currentTime = Math.max(0, video.currentTime - 10);
    }
  });

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'ag-player-btn ag-btn-play';
  playBtn.setAttribute('aria-label', 'Play');
  playBtn.title = 'Play (Space)';
  const PLAY_SVG = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  const PAUSE_SVG = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  playBtn.innerHTML = PLAY_SVG;

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'ag-player-btn ag-btn-next';
  const nextTitle = nextVideo ? `Next: ${nextVideo.title || 'Video'}` : 'Skip 10s';
  nextBtn.setAttribute('aria-label', nextTitle);
  nextBtn.title = nextTitle;
  nextBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`;
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (nextVideo && onNavigate) {
      onNavigate(nextVideo);
    } else {
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
    }
  });

  const volGroup = document.createElement('div');
  volGroup.className = 'ag-volume-group';

  const volBtn = document.createElement('button');
  volBtn.type = 'button';
  volBtn.className = 'ag-player-btn ag-btn-volume';
  volBtn.setAttribute('aria-label', 'Mute');
  const VOL_HIGH_SVG = `<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
  const VOL_MUTE_SVG = `<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l4.73 4.73H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
  volBtn.innerHTML = VOL_HIGH_SVG;

  const volSlider = document.createElement('input');
  volSlider.type = 'range';
  volSlider.min = '0';
  volSlider.max = '1';
  volSlider.step = '0.05';
  volSlider.value = '1';
  volSlider.className = 'ag-volume-slider';
  volSlider.setAttribute('aria-label', 'Volume');

  volGroup.append(volBtn, volSlider);

  const timeDisplay = document.createElement('div');
  timeDisplay.className = 'ag-player-time';
  timeDisplay.innerHTML = `<span class="ag-time-cur">0:00</span><span class="ag-time-sep">/</span><span class="ag-time-dur">0:00</span>`;

  leftGroup.append(prevBtn, playBtn, nextBtn, volGroup, timeDisplay);

  const rightGroup = document.createElement('div');
  rightGroup.className = 'ag-controls-group';

  const settingsBtn = document.createElement('button');
  settingsBtn.type = 'button';
  settingsBtn.className = 'ag-player-btn ag-btn-settings';
  settingsBtn.setAttribute('aria-label', 'More options');
  settingsBtn.title = 'Playback speed & download';
  settingsBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.classList.toggle('is-open');
  });

  const fsBtn = document.createElement('button');
  fsBtn.type = 'button';
  fsBtn.className = 'ag-player-btn ag-btn-fullscreen';
  fsBtn.setAttribute('aria-label', 'Fullscreen');
  fsBtn.title = 'Fullscreen (f)';
  const FS_ENTER_SVG = `<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`;
  const FS_EXIT_SVG = `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`;
  fsBtn.innerHTML = FS_ENTER_SVG;

  rightGroup.append(settingsBtn, fsBtn);
  controlsRow.append(leftGroup, rightGroup);
  controls.appendChild(controlsRow);

  container.append(video, overlay, bigPlay, topBar, popover, controls);

  function togglePlay() {
    if (video.paused || video.ended) {
      video.play().catch(err => console.warn('Play prevented', err));
    } else {
      video.pause();
    }
  }
  playBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
  bigPlay.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
  overlay.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

  video.addEventListener('play', () => {
    container.classList.add('is-playing');
    container.classList.remove('is-paused');
    playBtn.innerHTML = PAUSE_SVG;
    playBtn.setAttribute('aria-label', 'Pause');
    resetIdleTimer();
  });
  video.addEventListener('pause', () => {
    container.classList.remove('is-playing');
    container.classList.add('is-paused');
    playBtn.innerHTML = PLAY_SVG;
    playBtn.setAttribute('aria-label', 'Play');
    container.classList.remove('user-idle');
  });
  video.addEventListener('ended', () => {
    container.classList.remove('is-playing');
    playBtn.innerHTML = PLAY_SVG;
    if (nextVideo && onNavigate) {
      onNavigate(nextVideo);
    }
  });

  const curTimeEl = timeDisplay.querySelector('.ag-time-cur');
  const durTimeEl = timeDisplay.querySelector('.ag-time-dur');

  function updateDuration() {
    if (video.duration && isFinite(video.duration)) {
      durTimeEl.textContent = formatVideoTime(video.duration);
    }
  }
  video.addEventListener('loadedmetadata', updateDuration);
  video.addEventListener('durationchange', updateDuration);

  video.addEventListener('timeupdate', () => {
    if (!isScrubbing) {
      const cur = video.currentTime || 0;
      const dur = video.duration || 0;
      const pct = dur > 0 ? (cur / dur) * 100 : 0;
      progressBar.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
      curTimeEl.textContent = formatVideoTime(cur);
    }
  });

  video.addEventListener('progress', () => {
    if (video.buffered.length > 0 && video.duration) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      const pct = (bufferedEnd / video.duration) * 100;
      bufferBar.style.width = `${pct}%`;
    }
  });

  let isScrubbing = false;
  function seekTo(e) {
    const rect = timeline.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX) ?? 0;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    progressBar.style.width = `${pos * 100}%`;
    thumb.style.left = `${pos * 100}%`;
    if (video.duration) {
      video.currentTime = pos * video.duration;
      curTimeEl.textContent = formatVideoTime(video.currentTime);
    }
  }

  timeline.addEventListener('pointerdown', (e) => {
    isScrubbing = true;
    timeline.classList.add('is-scrubbing');
    timeline.setPointerCapture(e.pointerId);
    seekTo(e);
  });
  timeline.addEventListener('pointermove', (e) => {
    const rect = timeline.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    tooltip.style.left = `${pos * 100}%`;
    if (video.duration) {
      tooltip.textContent = formatVideoTime(pos * video.duration);
    }
    if (isScrubbing) seekTo(e);
  });
  const finishScrub = () => {
    if (isScrubbing) {
      isScrubbing = false;
      timeline.classList.remove('is-scrubbing');
    }
  };
  timeline.addEventListener('pointerup', finishScrub);
  timeline.addEventListener('pointercancel', finishScrub);

  let previousVolume = 1;
  volBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (video.muted || video.volume === 0) {
      video.muted = false;
      video.volume = previousVolume || 1;
      volSlider.value = String(video.volume);
      volBtn.innerHTML = VOL_HIGH_SVG;
    } else {
      previousVolume = video.volume;
      video.muted = true;
      volSlider.value = '0';
      volBtn.innerHTML = VOL_MUTE_SVG;
    }
  });
  volSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    video.volume = val;
    video.muted = val === 0;
    volBtn.innerHTML = val === 0 ? VOL_MUTE_SVG : VOL_HIGH_SVG;
  });

  function isFsActive() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }
  async function toggleFs() {
    try {
      if (!isFsActive()) {
        if (container.requestFullscreen) await container.requestFullscreen();
        else if (container.webkitRequestFullscreen) await container.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen error', err);
    }
  }
  fsBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFs(); });
  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isFsActive()) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  });
  overlay.addEventListener('dblclick', (e) => { e.stopPropagation(); toggleFs(); });

  function syncFullscreen() {
    const inFs = isFsActive();
    container.classList.toggle('is-fullscreen', inFs);
    fsBtn.innerHTML = inFs ? FS_EXIT_SVG : FS_ENTER_SVG;
    fsBtn.setAttribute('aria-label', inFs ? 'Exit Fullscreen' : 'Fullscreen');
    fsBtn.title = inFs ? 'Exit Fullscreen (f)' : 'Fullscreen (f)';
  }
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('webkitfullscreenchange', syncFullscreen);

  let idleTimeout = null;
  function resetIdleTimer() {
    container.classList.remove('user-idle');
    clearTimeout(idleTimeout);
    if (!video.paused && !popover.classList.contains('is-open')) {
      idleTimeout = setTimeout(() => {
        container.classList.add('user-idle');
      }, 2800);
    }
  }
  container.addEventListener('mousemove', resetIdleTimer);
  container.addEventListener('touchstart', resetIdleTimer, { passive: true });
  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && e.target !== settingsBtn) {
      popover.classList.remove('is-open');
    }
  });

  container.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'f') {
      e.preventDefault();
      toggleFs();
    } else if (e.key === 'm') {
      e.preventDefault();
      volBtn.click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 5);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      video.volume = Math.min(1, video.volume + 0.1);
      volSlider.value = String(video.volume);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      video.volume = Math.max(0, video.volume - 0.1);
      volSlider.value = String(video.volume);
    }
  });

  return container;
}

function createPremiumYouTubePlayer({
  ytId,
  title = '',
  posterUrl = '',
  prevVideo = null,
  nextVideo = null,
  onNavigate = null,
  autoplay = false,
  muteAutoplay = false
}) {
  const container = document.createElement('div');
  container.className = 'ag-tv-player-box ag-premium-player ag-youtube-player';

  const preview = document.createElement('div');
  preview.className = 'journal-video-preview';
  preview.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; z-index: 5; cursor: pointer;';

  if (posterUrl) {
    const img = document.createElement('img');
    img.src = safeMediaUrl(posterUrl);
    img.alt = title || 'Video thumbnail';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    preview.appendChild(img);
  }

  const bigPlay = document.createElement('div');
  bigPlay.className = 'ag-player-big-play';
  bigPlay.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
  preview.appendChild(bigPlay);

  const topBar = document.createElement('div');
  topBar.className = 'ag-player-top-bar';

  if (prevVideo && onNavigate) {
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'ag-player-minimize-btn';
    prevBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg> <span>Prev</span>`;
    prevBtn.title = `Previous: ${prevVideo.title || 'Video'}`;
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); onNavigate(prevVideo); });
    topBar.appendChild(prevBtn);
  }

  if (nextVideo && onNavigate) {
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'ag-player-minimize-btn';
    nextBtn.innerHTML = `<span>Next</span> <svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`;
    nextBtn.title = `Next: ${nextVideo.title || 'Video'}`;
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); onNavigate(nextVideo); });
    topBar.appendChild(nextBtn);
  }

  const minimizeBtn = document.createElement('button');
  minimizeBtn.type = 'button';
  minimizeBtn.className = 'ag-player-minimize-btn';
  minimizeBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg> <span>Minimize</span>`;
  minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.fullscreenElement) document.exitFullscreen();
  });
  topBar.appendChild(minimizeBtn);

  const createFrame = () => {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&playsinline=1&rel=0${muteAutoplay ? '&mute=1' : ''}`;
    iframe.title = title || 'Video Player';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    return iframe;
  };

  if (autoplay) {
    container.append(createFrame(), topBar);
    return container;
  }

  preview.addEventListener('click', () => preview.replaceWith(createFrame()), { once: true });

  container.append(preview, topBar);
  return container;
}

function addMediaViewer(parent, mediaUrl, mediaType, title, className = 'journal-media-viewer', posterUrl = '', directVideoAsset = false, entry = null) {
  const embed = mediaEmbed(mediaUrl, mediaType, directVideoAsset);
  if (!embed) return false;
  const viewer = document.createElement('div');
  viewer.className = className;
  if (embed.kind === 'video') {
    const download = getSanityVideoDownload(entry);
    const player = createPremiumVideoPlayer({
      videoUrl: embed.src,
      downloadUrl: download.url,
      downloadSize: download.size,
      posterUrl,
      title,
      autoplay: false
    });
    viewer.appendChild(player);
  } else if (embed.kind === 'youtube') {
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'journal-video-preview';
    preview.setAttribute('aria-label', `Load video player: ${title || 'YouTube video'}`);
    const image = document.createElement('img');
    const customPoster = safeMediaUrl(posterUrl);
    const thumbnailSources = [...new Set([customPoster, ...embed.thumbnails].filter(Boolean))];
    let thumbnailIndex = 0;
    image.alt = '';
    image.loading = 'lazy';
    image.src = thumbnailSources[thumbnailIndex];
    image.addEventListener('error', () => {
      thumbnailIndex += 1;
      if (thumbnailIndex < thumbnailSources.length) image.src = thumbnailSources[thumbnailIndex];
      else image.remove();
    });
    preview.append(image);
    const playLabel = document.createElement('span');
    playLabel.className = 'ag-player-big-play';
    playLabel.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    preview.append(playLabel);
    preview.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = embed.src + (embed.src.includes('?') ? '&autoplay=1' : '?autoplay=1');
      frame.title = title ? `${title} embedded video` : 'Embedded YouTube video';
      frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allowFullscreen = true;
      preview.replaceWith(frame);
    }, { once: true });
    viewer.appendChild(preview);
  } else {
    const frame = document.createElement('iframe');
    frame.src = embed.src;
    frame.title = title ? `${title} embedded media` : 'Embedded journal media';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    if (embed.src.startsWith('https://www.youtube-nocookie.com/')) frame.allow = 'accelerometer; encrypted-media; picture-in-picture';
    viewer.appendChild(frame);
  }
  parent.appendChild(viewer);
  return true;
}

function updateJournalTabs() {
  document.querySelectorAll('[data-journal-tab]').forEach(button => {
    const selected = button.dataset.journalTab === currentJournalTab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    button.classList.toggle('active', selected);
  });
  feed.setAttribute('aria-labelledby', currentJournalTab === 'tv' ? 'journal-tab-tv' : 'journal-tab-journal');
}

function setJournalTab(tab) {
  navigateGallery({ tab: tab === 'tv' ? 'tv' : 'journal', folderId: null, entryId: null });
}

function galleryRouteFromLocation(state = history.state) {
  if (state?.galleryRoute) return state.galleryRoute;
  if (!location.hash.startsWith('#gallery?')) return null;
  const params = new URLSearchParams(location.hash.slice('#gallery?'.length));
  return {
    tab: params.get('tab') === 'tv' ? 'tv' : 'journal',
    folderId: params.get('folder') || null,
    entryId: params.get('entry') || null,
    depth: 0
  };
}

function syncGalleryHistory(replace = false) {
  if (!replace) galleryHistoryDepth += 1;
  const route = {
    tab: currentJournalTab,
    folderId: currentFolderId,
    entryId: currentEntryId,
    depth: galleryHistoryDepth
  };
  const params = new URLSearchParams();
  if (route.tab === 'tv') params.set('tab', 'tv');
  if (route.folderId) params.set('folder', route.folderId);
  if (route.entryId) params.set('entry', route.entryId);
  const url = new URL(location.href);
  url.hash = params.size ? `gallery?${params}` : '';
  const state = { ...(history.state || {}), galleryRoute: route };
  if (replace) history.replaceState(state, '', url);
  else history.pushState(state, '', url);
}

function navigateGallery({ tab = currentJournalTab, folderId = null, entryId = null }, { loadingFolder = false, replace = false } = {}) {
  clearTimeout(folderLoadingTimer);
  hideFolderPreloader();
  currentJournalTab = tab;
  currentFolderId = folderId;
  currentEntryId = entryId;
  pendingFolderLoadId = loadingFolder ? folderId : null;
  syncGalleryHistory(replace);
  renderJournal();
  if (pendingFolderLoadId) {
    const loadingFolderId = pendingFolderLoadId;
    folderLoadingTimer = setTimeout(() => {
      if (pendingFolderLoadId !== loadingFolderId) return;
      pendingFolderLoadId = null;
      hideFolderPreloader();
      renderJournal();
    }, 1550);
  }
}

function navigateBack(fallback) {
  if (galleryHistoryDepth > 0) {
    history.back();
    return;
  }
  navigateGallery(fallback);
}

function section(title, className = '', parent = feed) {
  const wrapper = document.createElement('section');
  wrapper.className = `journal-section ${className}`.trim();
  addText(wrapper, 'h2', title);
  const grid = document.createElement('div');
  grid.className = 'journal-cards';
  wrapper.appendChild(grid);
  parent.appendChild(wrapper);
  return grid;
}

function renderFolderCard(folder, target) {
  const card = document.createElement('article');
  card.className = 'journal-item journal-folder';
  const openFolder = document.createElement('a');
  openFolder.className = 'journal-folder-open';
  openFolder.href = `#gallery?tab=journal&folder=${encodeURIComponent(folder._id)}`;
  openFolder.setAttribute('aria-label', `Open folder: ${folder.title || 'Untitled folder'}`);
  openFolder.addEventListener('click', event => {
    event.preventDefault();
    navigateGallery({ tab: 'journal', folderId: folder._id }, { loadingFolder: true });
  });
  const cover = document.createElement('div');
  cover.className = 'journal-folder-cover';
  const coverUrl = safeMediaUrl(folder.coverUrl);
  if (coverUrl) {
    const image = document.createElement('img');
    image.src = coverUrl;
    image.alt = folder.title ? `${folder.title} folder cover` : 'Journal folder cover';
    image.loading = 'lazy';
    cover.appendChild(image);
  }
  const coverText = document.createElement('div');
  coverText.className = 'journal-folder-cover-text';
  addText(coverText, 'h2', folder.coverHeading || folder.title || 'News & Gallery');
  const coverSubheading = folder.coverSubheading || folder.category;
  if (coverSubheading) addText(coverText, 'p', coverSubheading);
  cover.appendChild(coverText);
  openFolder.appendChild(cover);

  const content = document.createElement('div');
  content.className = 'journal-folder-content';
  addText(content, 'p', folder.eyebrow || 'FOLLOW OUR SOCIALS FOR UPDATES', 'journal-folder-eyebrow');
  addText(content, 'h3', folder.title || 'Untitled folder');
  const categoryLine = [folder.category, folder.organization].filter(Boolean).join(' · ');
  if (categoryLine) addText(content, 'p', categoryLine, 'journal-folder-category');
  if (folder.description) addText(content, 'p', folder.description, 'journal-folder-description');
  openFolder.appendChild(content);
  card.appendChild(openFolder);

  const actions = document.createElement('div');
  actions.className = 'journal-folder-actions';
  const detailsButton = document.createElement('button');
  detailsButton.type = 'button';
  detailsButton.className = 'journal-folder-details';
  detailsButton.setAttribute('aria-label', `View details for ${folder.title || 'folder'}`);
  const eyeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  eyeIcon.setAttribute('viewBox', '0 0 24 24');
  eyeIcon.setAttribute('width', '18');
  eyeIcon.setAttribute('height', '18');
  eyeIcon.setAttribute('fill', 'none');
  eyeIcon.setAttribute('stroke', 'currentColor');
  eyeIcon.setAttribute('stroke-width', '2');
  eyeIcon.setAttribute('aria-hidden', 'true');
  const eyeOutline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  eyeOutline.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z');
  const eyePupil = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  eyePupil.setAttribute('cx', '12');
  eyePupil.setAttribute('cy', '12');
  eyePupil.setAttribute('r', '3');
  eyeIcon.append(eyeOutline, eyePupil);
  detailsButton.append(eyeIcon, document.createTextNode('VIEW DETAILS'));
  detailsButton.addEventListener('click', () => {
    navigateGallery({ tab: 'journal', folderId: folder._id }, { loadingFolder: true });
  });
  actions.appendChild(detailsButton);
  const updateUrl = safeMediaUrl(folder.updateUrl);
  if (updateUrl) {
    const updateLink = document.createElement('a');
    updateLink.href = updateUrl;
    updateLink.target = '_blank';
    updateLink.rel = 'noopener noreferrer';
    updateLink.className = 'journal-folder-update';
    updateLink.textContent = `${folder.updateText || 'STAY UPDATED'} →`;
    updateLink.setAttribute('aria-label', `${folder.updateText || 'Stay updated'}: ${folder.title || 'News & Gallery folder'}`);
    actions.appendChild(updateLink);
  } else {
    addButton(actions, `${folder.updateText || 'STAY UPDATED'} →`, () => {
      navigateGallery({ tab: 'journal', folderId: folder._id }, { loadingFolder: true });
    }, 'journal-folder-update');
  }
  card.appendChild(actions);
  target.appendChild(card);
}

function renderEntryCard(entry, target) {
  const card = document.createElement('article');
  card.className = 'journal-item journal-entry-card';
  const imageUrl = safeMediaUrl(entry.imageUrl);
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = entry.title || 'Journal story';
    image.loading = 'lazy';
    card.appendChild(image);
  }
  addText(card, 'p', entry.entryType || 'Story', 'section-eyebrow');
  addText(card, 'h3', entry.title || 'Untitled story');
  const dateLabel = formatDate(entry.eventDate || entry.publishedAt);
  const meta = dateLabel;
  if (meta) addText(card, 'p', meta, 'journal-meta');
  addEntryMetadata(card, entry);
  const readButton = addButton(card, 'READ →', () => {
    navigateGallery({ folderId: currentFolderId, entryId: entry._id });
  }, 'journal-button journal-entry-action');
  readButton.setAttribute('aria-label', `Read ${entry.title || 'story'}`);
  target.appendChild(card);
}

function renderLegacyPost(post) {
  const article = document.createElement('article');
  article.className = 'journal-item';
  addText(article, 'p', 'Story', 'section-eyebrow');
  addText(article, 'h3', post.title || 'Untitled');
  if (post.publishedAt) addText(article, 'p', formatDate(post.publishedAt), 'journal-meta');
  if (post.excerpt) addText(article, 'p', post.excerpt);
  if (post.body) addText(article, 'p', post.body);
  return article;
}

function renderLegacyMedia(item) {
  const article = document.createElement('article');
  article.className = 'journal-item';
  const url = safeMediaUrl(item.imageUrl || item.fileUrl || item.assetUrl);
  const type = item.kind || 'document';
  addText(article, 'p', type === 'image' ? 'Image' : type === 'video' ? 'Video' : 'Document', 'section-eyebrow');
  addText(article, 'h3', item.title || 'Untitled media');
  if (item.description) addText(article, 'p', item.description);
  if (url && type === 'image') {
    const image = document.createElement('img');
    image.src = url;
    image.alt = item.title || 'Gallery image';
    image.loading = 'lazy';
    article.insertBefore(image, article.querySelector('h3'));
  } else if (url && type === 'video') {
    const player = createPremiumVideoPlayer({ videoUrl: url, title: item.title, autoplay: false });
    article.insertBefore(player, article.querySelector('h3'));
  } else if (url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'journal-file';
    link.textContent = 'Open document';
    article.appendChild(link);
  }
  return article;
}

function renderEntryDetail(entry) {
  const folder = journalFolders.find(item => item._id === entry.folderId);
  const article = document.createElement('article');
  article.className = 'journal-item journal-detail';
  addButton(article, currentJournalTab === 'tv' ? 'Back to ARTGALZIM TV' : 'Back to folder', () => {
    navigateBack({ tab: currentJournalTab, folderId: entry.folderId || null, entryId: null });
  }, 'journal-back');
  if (currentJournalTab !== 'tv') {
    const layout = document.createElement('div');
    layout.className = 'journal-detail-layout';
    const mediaColumn = document.createElement('section');
    mediaColumn.className = 'journal-detail-media-column';
    const imageUrls = [...new Set([
      ...(Array.isArray(entry.imageUrls) ? entry.imageUrls : []),
      entry.imageUrl
    ].map(safeMediaUrl).filter(Boolean))];
    if (imageUrls.length) {
      const gallery = document.createElement('div');
      gallery.className = 'journal-detail-gallery';
      const mainImage = document.createElement('img');
      mainImage.className = 'journal-detail-image';
      mainImage.src = imageUrls[0];
      mainImage.alt = entry.title || 'News & Gallery story';
      mainImage.loading = 'lazy';
      gallery.appendChild(mainImage);
      if (imageUrls.length > 1) {
        const thumbnails = document.createElement('div');
        thumbnails.className = 'journal-detail-thumbnails';
        imageUrls.forEach((url, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'journal-detail-thumbnail';
          button.setAttribute('aria-label', `Show image ${index + 1}`);
          button.setAttribute('aria-pressed', index === 0 ? 'true' : 'false');
          const thumbnail = document.createElement('img');
          thumbnail.src = url;
          thumbnail.alt = '';
          thumbnail.loading = 'lazy';
          button.appendChild(thumbnail);
          button.addEventListener('click', () => {
            mainImage.src = url;
            thumbnails.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', 'false'));
            button.setAttribute('aria-pressed', 'true');
          });
          thumbnails.appendChild(button);
        });
        gallery.appendChild(thumbnails);
      }
      mediaColumn.appendChild(gallery);
    }
    const mediaUrl = safeMediaUrl(entry.mediaUrl);
    const mediaType = entry.mediaType || '';
    if (mediaUrl) {
      if (!addMediaViewer(mediaColumn, mediaUrl, mediaType, entry.title, 'journal-media-viewer', imageUrls[0], false, entry)) {
        addText(mediaColumn, 'p', 'This media link cannot be embedded. Please contact the gallery for access.', 'journal-meta');
      }
    }
    const attachmentUrl = safeMediaUrl(entry.fileUrl || entry.attachmentUrl);
    if (attachmentUrl) {
      const attachmentName = entry.attachmentName || '';
      if (/\.pdf$/i.test(attachmentName)) {
        addMediaViewer(mediaColumn, attachmentUrl, 'document', entry.title, 'journal-document-viewer');
      } else if (/\.(mp4|webm|ogv)$/i.test(attachmentName)) {
        addMediaViewer(mediaColumn, attachmentUrl, 'video', entry.title, 'journal-media-viewer', imageUrls[0], true, entry);
      } else if (/\.(mp3|m4a|wav|ogg)$/i.test(attachmentName)) {
        const audio = document.createElement('audio');
        audio.src = attachmentUrl;
        audio.controls = true;
        audio.preload = 'metadata';
        audio.setAttribute('aria-label', entry.title || 'News & Gallery audio');
        mediaColumn.appendChild(audio);
      } else if (/\.(jpe?g|png|gif|webp|avif)$/i.test(attachmentName)) {
        const image = document.createElement('img');
        image.className = 'journal-detail-image';
        image.src = attachmentUrl;
        image.alt = entry.title || 'News & Gallery attachment';
        image.loading = 'lazy';
        mediaColumn.appendChild(image);
      }
    }
    const actions = document.createElement('div');
    actions.className = 'journal-media-actions';
    if (mediaUrl) {
      const mediaLink = document.createElement('a');
      mediaLink.href = mediaUrl;
      mediaLink.target = '_blank';
      mediaLink.rel = 'noopener noreferrer';
      mediaLink.textContent = mediaType === 'video' ? 'Open video' : 'Open media';
      actions.appendChild(mediaLink);
    }
    if (attachmentUrl) {
      const fileLink = document.createElement('a');
      fileLink.href = attachmentUrl;
      fileLink.target = '_blank';
      fileLink.rel = 'noopener noreferrer';
      fileLink.textContent = entry.attachmentName || 'Open attachment';
      actions.appendChild(fileLink);
    }
    if (actions.childElementCount) mediaColumn.appendChild(actions);

    const copy = document.createElement('div');
    copy.className = 'journal-detail-content';
    addText(copy, 'p', entry.entryType || 'Story', 'section-eyebrow');
    addText(copy, 'h2', entry.title || 'Untitled story');
    const dateLabel = formatDate(entry.eventDate || entry.publishedAt);
    const dates = [dateLabel, formatDate(entry.endDate)].filter(Boolean).join(' – ');
    if (dates) addText(copy, 'p', dates, 'journal-meta');
    addEntryMetadata(copy, entry);
    if (folder) addText(copy, 'p', folder.title, 'journal-meta');
    if (entry.excerpt) {
      addText(copy, 'h3', 'Description', 'journal-detail-section-title');
      const description = document.createElement('div');
      description.className = 'journal-detail-excerpt journal-rich-content';
      appendSafeRichContent(description, entry.excerpt);
      copy.appendChild(description);
    }
    if (entry.body) {
      addText(copy, 'h3', 'Story details', 'journal-detail-section-title');
      const story = document.createElement('div');
      story.className = 'journal-detail-body journal-rich-content';
      appendSafeRichContent(story, entry.body);
      copy.appendChild(story);
    }
    layout.append(mediaColumn, copy);
    article.appendChild(layout);
    feed.appendChild(article);
    return;
  }
  addText(article, 'p', entry.entryType || 'Story', 'section-eyebrow');
  addText(article, 'h2', entry.title || 'Untitled story');
  const dateLabel = formatDate(entry.eventDate || entry.publishedAt);
  const dates = [dateLabel, formatDate(entry.endDate)].filter(Boolean).join(' – ');
  const meta = currentJournalTab === 'tv'
    ? [dates, entry.location, entry.author ? `By ${entry.author}` : ''].filter(Boolean).join(' · ')
    : dates;
  if (meta) addText(article, 'p', meta, 'journal-meta');
  if (currentJournalTab !== 'tv') addEntryMetadata(article, entry);
  if (folder) addText(article, 'p', folder.title, 'journal-meta');
  const imageUrl = safeMediaUrl(entry.imageUrl);
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = entry.title || 'Journal story';
    image.loading = 'lazy';
    article.appendChild(image);
  }
  const mediaUrl = entry.mediaUrl || '';
  const mediaType = entry.mediaType || '';
  if (mediaUrl && !addMediaViewer(article, mediaUrl, mediaType, entry.title, 'journal-media-viewer', entry.imageUrl, false, entry)) {
    addText(article, 'p', 'This media link cannot be embedded. Please contact the gallery for access.', 'journal-meta');
  }
  if (entry.excerpt && currentJournalTab === 'tv') addText(article, 'p', entry.excerpt, 'journal-detail-excerpt');
  if (entry.body) addText(article, 'p', entry.body, 'journal-detail-body');
  const attachmentUrl = safeMediaUrl(entry.fileUrl || entry.attachmentUrl);
  if (attachmentUrl) {
    const attachmentName = entry.attachmentName || '';
    if (/\.pdf$/i.test(attachmentName)) {
      addMediaViewer(article, attachmentUrl, 'document', entry.title, 'journal-document-viewer');
    } else if (/\.(mp4|webm|ogv)$/i.test(attachmentName)) {
      addMediaViewer(article, attachmentUrl, 'video', entry.title, 'journal-media-viewer', entry.imageUrl, true, entry);
    } else if (/\.(mp3|m4a|wav|ogg)$/i.test(attachmentName)) {
      const audio = document.createElement('audio');
      audio.src = attachmentUrl;
      audio.controls = true;
      audio.preload = 'metadata';
      audio.setAttribute('aria-label', entry.title || 'Journal audio');
      article.appendChild(audio);
    } else if (/\.(jpe?g|png|gif|webp|avif)$/i.test(attachmentName)) {
      const image = document.createElement('img');
      image.src = attachmentUrl;
      image.alt = entry.title || 'Journal attachment';
      image.loading = 'lazy';
      article.appendChild(image);
    } else {
      const link = document.createElement('a');
      link.href = attachmentUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.className = 'journal-file';
      link.textContent = entry.attachmentName || 'Download attachment';
      article.appendChild(link);
    }
  }
  feed.appendChild(article);
}

function showTvToast(message) {
  let toastEl = document.getElementById('agTvToast');
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'agTvToast';
    toastEl.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f1f1f;color:#fff;border:1px solid rgba(201,168,76,0.4);padding:10px 22px;border-radius:999px;font-size:0.85rem;font-weight:600;box-shadow:0 10px 25px rgba(0,0,0,0.6);z-index:99999;transition:opacity 0.25s,transform 0.25s;pointer-events:none;display:flex;align-items:center;gap:8px;';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.style.opacity = '1';
  toastEl.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastEl._timer);
  toastEl._timer = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(-50%) translateY(10px)';
  }, 2600);
}

const TV_VIEWS_KEY = 'ag_tv_views_v1';
const TV_LIKES_KEY = 'ag_tv_likes_v1';
const TV_USER_LIKES_KEY = 'ag_tv_user_likes_v1';

function getTvViewsMap() {
  try {
    return JSON.parse(localStorage.getItem(TV_VIEWS_KEY) || '{}');
  } catch {
    return {};
  }
}

function recordVideoPlay(videoId) {
  if (!videoId) return 0;
  const map = getTvViewsMap();
  const current = Number(map[videoId]) || 0;
  const next = current + 1;
  map[videoId] = next;
  try {
    localStorage.setItem(TV_VIEWS_KEY, JSON.stringify(map));
  } catch {}
  return next;
}

function getVideoViewCount(videoId) {
  if (!videoId) return 0;
  const map = getTvViewsMap();
  return Number(map[videoId]) || 0;
}

function formatViewsLabel(count) {
  if (count === 0) return '0 views';
  if (count === 1) return '1 view';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M views`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${count} views`;
}

function formatLikesLabel(count) {
  if (!count || count <= 0) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(count);
}

const TV_LIKE_OUTLINE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M18.77 11h-4.23l1.52-4.94C16.38 5.03 15.54 4 14.38 4c-.58 0-1.14.24-1.52.65L7 11H3v10h4h1h9.43c1.06 0 1.98-.67 2.19-1.61l1.34-6c.27-1.24-.78-2.39-2.19-2.39zM7 20H4v-8h3v8zm12.98-6.83l-1.34 6c-.06.28-.61.83-1.21.83H8v-8.61l5.6-6.06c.19-.21.48-.33.78-.33.26 0 .5.11.63.3.07.1.15.26.09.47l-1.52 4.94L13.18 12h1.35h4.23c.41 0 .8.17 1.03.46.13.15.26.4.19.71z"/></svg>';
const TV_LIKE_FILLED_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 11h4v10H3zm15.77 0h-4.23l1.52-4.94C16.38 5.03 15.54 4 14.38 4c-.58 0-1.14.24-1.52.65L7 11v10h10.43c1.06 0 1.98-.67 2.19-1.61l1.34-6c.27-1.24-.78-2.39-2.19-2.39z"/></svg>';

const TV_DISLIKE_OUTLINE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17 4h-1H6.57C5.5 4 4.59 4.67 4.38 5.61l-1.34 6C2.77 12.85 3.82 14 5.23 14h4.23l-1.52 4.94C7.62 19.97 8.46 21 9.62 21c.58 0 1.14-.24 1.52-.65L17 14h4V4h-4zM5.23 13C4.82 13 4.43 12.83 4.2 12.54c-.13-.15-.26-.4-.19-.71l1.34-6c.06-.28.61-.83 1.21-.83H16v8.61l-5.6 6.06c-.19.21-.48.33-.78.33-.26 0-.5-.11-.63-.3-.07-.1-.15-.26-.09-.47l1.52-4.94L10.82 13H9.47H5.23zM20 13h-3V5h3v8z"/></svg>';
const TV_DISLIKE_FILLED_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M21 14h-4V4h4zm-15.77 0h4.23l-1.52 4.94C7.62 19.97 8.46 21 9.62 21c.58 0 1.14-.24 1.52-.65L17 14V4H6.57C5.5 4 4.59 4.67 4.38 5.61l-1.34 6C2.77 12.85 3.82 14 5.23 14z"/></svg>';

function getTvLikesMap() {
  try {
    return JSON.parse(localStorage.getItem(TV_LIKES_KEY) || '{}');
  } catch {
    return {};
  }
}

function getTvUserLikes() {
  try {
    return JSON.parse(localStorage.getItem(TV_USER_LIKES_KEY) || '{}');
  } catch {
    return {};
  }
}

function getVideoLikeCount(videoId) {
  if (!videoId) return 0;
  const map = getTvLikesMap();
  return Number(map[videoId]) || 0;
}

function isVideoLikedByUser(videoId) {
  if (!videoId) return false;
  const userLikes = getTvUserLikes();
  return Boolean(userLikes[videoId]);
}

function toggleVideoLike(videoId) {
  if (!videoId) return { count: 0, liked: false };
  const map = getTvLikesMap();
  const userLikes = getTvUserLikes();
  const alreadyLiked = Boolean(userLikes[videoId]);
  let count = Number(map[videoId]) || 0;

  if (alreadyLiked) {
    count = Math.max(0, count - 1);
    delete userLikes[videoId];
  } else {
    count = count + 1;
    userLikes[videoId] = true;
  }

  map[videoId] = count;
  try {
    localStorage.setItem(TV_LIKES_KEY, JSON.stringify(map));
    localStorage.setItem(TV_USER_LIKES_KEY, JSON.stringify(userLikes));
  } catch {}

  return { count, liked: !alreadyLiked };
}

function formatTvRelativeTimer(timestamp) {
  if (!timestamp) return 'Just Recent';
  const time = new Date(timestamp).getTime();
  if (isNaN(time)) return 'Just Recent';
  const now = Date.now();
  const diffMs = Math.max(0, now - time);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  // 1. Period after posting while waiting for 1 hour
  if (diffHours < 1) {
    return 'Just Recent';
  }
  // 2. 1 hour ago going onwards till 1 day ago
  if (diffDays < 1) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }
  // 3. 1 day ago, 2 days till a week arrives
  if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  }
  // 4. 1 week till 4 weeks a month and switches to 1 month ago
  if (diffDays < 30) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  }

  // 5. Switches to 1 month ago till, 2 months and counts only months till 1 year
  const dateObj = new Date(time);
  const nowDate = new Date(now);
  let months = (nowDate.getFullYear() - dateObj.getFullYear()) * 12 + (nowDate.getMonth() - dateObj.getMonth());
  if (nowDate.getDate() < dateObj.getDate()) months--;
  months = Math.max(1, months);

  const years = Math.floor(months / 12);
  if (years < 1) {
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  // 6. Counts only years (2 years ago etc.), strictly single unit
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function formatTvSingleDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Harare'
    }).format(d);
  } catch (e) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

function formatTvDateRange(startDateStr, endDateStr) {
  if (!startDateStr && !endDateStr) return '';
  if (startDateStr && !endDateStr) return formatTvSingleDate(startDateStr);
  if (!startDateStr && endDateStr) return formatTvSingleDate(endDateStr);

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return `${startDateStr} – ${endDateStr}`;
  }

  try {
    const parts = (date) => {
      const dtf = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Harare'
      });
      const map = {};
      dtf.formatToParts(date).forEach(p => { map[p.type] = p.value; });
      return { day: map.day, month: map.month, year: map.year };
    };
    const s = parts(start);
    const e = parts(end);
    if (s.year === e.year && s.month === e.month) {
      if (s.day === e.day) return `${s.day} ${s.month} ${s.year}`;
      return `${s.day} – ${e.day} ${s.month} ${s.year}`;
    }
    if (s.year === e.year) {
      return `${s.day} ${s.month} – ${e.day} ${e.month} ${s.year}`;
    }
    return `${s.day} ${s.month} ${s.year} – ${e.day} ${e.month} ${e.year}`;
  } catch (err) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = months[start.getMonth()];
    const endMonth = months[end.getMonth()];
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    if (startYear === endYear && startMonth === endMonth) {
      if (startDay === endDay) return `${startDay} ${startMonth} ${startYear}`;
      return `${startDay} – ${endDay} ${startMonth} ${startYear}`;
    }
    if (startYear === endYear) {
      return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
    }
    return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
  }
}

function getTvVideoThumbnail(entry) {
  const candidate = getTvThumbnailCandidates(entry)[0];
  if (candidate) return safeMediaUrl(candidate);
  return entry.videoOrientation === 'portrait' ? '/images/MAIN IMAGES/home/artwork_1.webp' : '/images/MAIN IMAGES/home/Art Gallery Frontview jpeg.jpeg';
}

function openShareModal(video) {
  const existing = document.getElementById('agTvShareModal');
  if (existing) existing.remove();

  const shareUrl = `${window.location.origin}/journal.html#gallery?tab=tv&entry=${encodeURIComponent(video._id)}`;
  const shareTitle = video.title || 'ARTGALZIM TV';
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(shareTitle);

  const overlay = document.createElement('div');
  overlay.id = 'agTvShareModal';
  overlay.className = 'ag-tv-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Share video');

  const card = document.createElement('div');
  card.className = 'ag-tv-modal-card';

  const header = document.createElement('div');
  header.className = 'ag-tv-modal-header';
  const title = document.createElement('h3');
  title.className = 'ag-tv-modal-title';
  title.innerHTML = `
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/>
    </svg> Share
  `;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ag-tv-modal-close';
  closeBtn.setAttribute('aria-label', 'Close share dialog');
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => overlay.remove());
  header.append(title, closeBtn);
  card.appendChild(header);

  const preview = document.createElement('div');
  preview.className = 'ag-tv-share-preview';
  const thumb = document.createElement('img');
  thumb.className = 'ag-tv-share-thumb';
  thumb.src = getTvVideoThumbnail(video);
  thumb.alt = shareTitle;
  const prevTitle = document.createElement('p');
  prevTitle.className = 'ag-tv-share-title';
  prevTitle.textContent = shareTitle;
  preview.append(thumb, prevTitle);
  card.appendChild(preview);

  const grid = document.createElement('div');
  grid.className = 'ag-tv-share-grid';

  const platforms = [
    {
      name: 'WhatsApp',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24">
        <path fill="#25D366" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.96L2.05 22l5.25-1.38c1.45.79 3.08 1.22 4.74 1.22 5.46 0 9.91-4.45 9.91-9.92A9.9 9.9 0 0 0 12.04 2z"/>
        <path fill="#FFFFFF" d="M17.47 14.39c-.27-.14-1.61-.79-1.86-.88-.25-.09-.43-.14-.61.14-.18.27-.71.88-.87 1.07-.16.18-.32.21-.59.07-.27-.14-1.15-.42-2.19-1.35-.81-.72-1.36-1.61-1.52-1.88-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.48-.84-2.03-.22-.53-.45-.46-.61-.47l-.52-.01c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27s.98 2.64 1.12 2.82c.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.56.57.65.21 1.25.18 1.72.11.53-.08 1.61-.66 1.84-1.29.23-.64.23-1.18.16-1.29-.07-.11-.25-.18-.52-.32z"/>
      </svg>`,
      url: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`
    },
    {
      name: 'TikTok',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24">
        <path fill="#25F4EE" d="M16.6 5.82s.51.5 0 0A4.27 4.27 0 0 1 15.54 3h-2.1v12.22a3.02 3.02 0 0 1-3.02 3.02 3.02 3.02 0 0 1-3.02-3.02c0-1.67 1.35-3.02 3.02-3.02.32 0 .63.05.92.15V9.42a5.95 5.95 0 0 0-.92-.07 5.94 5.94 0 0 0-5.94 5.94 5.94 5.94 0 0 0 5.94 5.94 5.94 5.94 0 0 0 5.94-5.94V7.61a7.28 7.28 0 0 0 3.25 1.15V6.47a5.03 5.03 0 0 1-3-.65z"/>
        <path fill="#FE2C55" d="M17.43 6.64a4.27 4.27 0 0 1-3.32-3.74h-2.1v12.22a3.02 3.02 0 0 1-3.02 3.02 3.02 3.02 0 0 1-3.02-3.02c0-1.67 1.35-3.02 3.02-3.02.32 0 .63.05.92.15V9.42a5.95 5.95 0 0 0-.92-.07 5.94 5.94 0 0 0-5.94 5.94 5.94 5.94 0 0 0 5.94 5.94 5.94 5.94 0 0 0 5.94-5.94V7.61a7.28 7.28 0 0 0 3.25 1.15V6.47a5.03 5.03 0 0 1-.74-.83z"/>
        <path fill="#FFFFFF" d="M17.01 6.23a4.27 4.27 0 0 1-3.32-3.74h-2.1v12.22a3.02 3.02 0 0 1-3.02 3.02 3.02 3.02 0 0 1-3.02-3.02c0-1.67 1.35-3.02 3.02-3.02.32 0 .63.05.92.15V9.42a5.95 5.95 0 0 0-.92-.07 5.94 5.94 0 0 0-5.94 5.94 5.94 5.94 0 0 0 5.94 5.94 5.94 5.94 0 0 0 5.94-5.94V7.61a7.28 7.28 0 0 0 3.25 1.15V6.47a5.03 5.03 0 0 1-2.91-.24z"/>
      </svg>`,
      onClick: async () => {
        try { await navigator.clipboard.writeText(shareUrl); } catch {}
        showTvToast('Link copied! Opening TikTok...');
        window.open('https://www.tiktok.com/', '_blank');
      }
    },
    {
      name: 'Instagram',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24">
        <defs>
          <linearGradient id="agInstaGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#FFDC80" />
            <stop offset="25%" stop-color="#F77737" />
            <stop offset="50%" stop-color="#F56040" />
            <stop offset="75%" stop-color="#FD1D1D" />
            <stop offset="100%" stop-color="#C13584" />
          </linearGradient>
        </defs>
        <path fill="url(#agInstaGrad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>`,
      onClick: async () => {
        try { await navigator.clipboard.writeText(shareUrl); } catch {}
        showTvToast('Link copied! Opening Instagram...');
        window.open('https://www.instagram.com/', '_blank');
      }
    },
    {
      name: 'Facebook',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    },
    {
      name: 'X (Twitter)',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#FFFFFF"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      url: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`
    },
    {
      name: 'LinkedIn',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#0A66C2"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.65 1.65 0 1 0 0-3.3 1.65 1.65 0 0 0 0 3.3m1.4 9.74v-8.37H5.06v8.37z"/></svg>`,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    },
    {
      name: 'Telegram',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#229ED9"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06-.01.18-.03.32z"/></svg>`,
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`
    },
    {
      name: 'Email',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="#C9A84C"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`,
      url: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`
    }
  ];

  platforms.forEach(p => {
    if (p.url) {
      const btn = document.createElement('a');
      btn.className = 'ag-tv-share-btn';
      btn.href = p.url;
      btn.target = '_blank';
      btn.rel = 'noopener noreferrer';
      btn.innerHTML = `${p.icon}<span>${p.name}</span>`;
      grid.appendChild(btn);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ag-tv-share-btn';
      btn.innerHTML = `${p.icon}<span>${p.name}</span>`;
      btn.addEventListener('click', p.onClick);
      grid.appendChild(btn);
    }
  });
  card.appendChild(grid);

  const copyRow = document.createElement('div');
  copyRow.className = 'ag-tv-share-copy-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'ag-tv-share-copy-input';
  input.readOnly = true;
  input.value = shareUrl;
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'ag-tv-share-copy-btn';
  copyBtn.textContent = 'Copy Link';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      copyBtn.textContent = 'Copied! ✓';
      showTvToast('Link copied to clipboard!');
      setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
    } catch {
      input.select();
      document.execCommand('copy');
      copyBtn.textContent = 'Copied! ✓';
      showTvToast('Link copied to clipboard!');
      setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
    }
  });
  copyRow.append(input, copyBtn);
  card.appendChild(copyRow);

  overlay.appendChild(card);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function renderTv() {
  const userVideos = journalEntries
    .filter(entry => isTvEntry(entry) && ['video', 'social'].includes(entry.mediaType)
      && (entry.mediaUrl || (entry.mediaType === 'video' && (entry.fileUrl || entry.attachmentUrl))))
    .sort((a, b) => String(b.eventDate || b.publishedAt || '').localeCompare(String(a.eventDate || a.publishedAt || '')));

  const allVideos = userVideos;
  if (!allVideos.length) {
    addText(feed, 'p', 'No ARTGALZIM TV videos have been published yet.', 'journal-empty');
    return;
  }

  const groups = groupTvVideos(allVideos);
  const selected = currentEntryId ? allVideos.find(entry => entry._id === currentEntryId) : null;
  const selectedIsShort = Boolean(selected && getTvVideoOrientation(selected) === 'portrait');
  document.body.classList.toggle('tv-shorts-watch-active', selectedIsShort);

  const layout = document.createElement('div');
  layout.className = 'journal-tv-layout';
  feed.append(layout);

  const durationObserver = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver(entries => {
      entries.forEach(observed => {
        if (!observed.isIntersecting) return;
        durationObserver.unobserve(observed.target);
        durationTargets.get(observed.target)?.();
      });
    }, { rootMargin: '240px 0px' })
    : null;
  const durationTargets = new WeakMap();

  function getVideoDuration(entry) {
    return getTvVideoDuration(entry);
  }

  function setTvThumbnail(image, entry, fallback) {
    const candidates = [...new Set([...getTvThumbnailCandidates(entry), fallback])];
    let candidateIndex = 0;
    const setNextCandidate = () => {
      candidateIndex += 1;
      if (candidateIndex < candidates.length) image.src = candidates[candidateIndex];
    };
    image.src = candidates[candidateIndex] || fallback;
    image.addEventListener('error', setNextCandidate);
  }

  function applyTvFocalPoint(image, entry) {
    const focusX = Number(entry.imagePosition?.x);
    const focusY = Number(entry.imagePosition?.y);
    const x = Number.isFinite(focusX) ? Math.max(0, Math.min(100, focusX)) : 50;
    const y = Number.isFinite(focusY) ? Math.max(0, Math.min(100, focusY)) : 50;
    image.style.objectPosition = `${x}% ${y}%`;
  }

  function observeTvDuration(card, entry, badge) {
    const savedDuration = getVideoDuration(entry);
    const source = safeMediaUrl(getTvVideoSourceUrl(entry));
    if (!source) {
      badge.textContent = savedDuration;
      badge.hidden = !savedDuration;
      return;
    }
    badge.textContent = '';
    badge.hidden = true;
    const detect = () => {
      const probe = document.createElement('video');
      probe.width = 1;
      probe.height = 1;
      probe.preload = 'metadata';
      const cleanup = () => {
        probe.removeAttribute('src');
        probe.load();
      };
      probe.addEventListener('loadedmetadata', () => {
        const duration = formatTvDuration(probe.duration);
        badge.textContent = duration || savedDuration;
        badge.hidden = !(duration || savedDuration);
        cleanup();
      }, { once: true });
      probe.addEventListener('error', () => {
        badge.textContent = savedDuration;
        badge.hidden = !savedDuration;
        cleanup();
      }, { once: true });
      probe.src = source;
    };
    if (durationObserver) {
      badge.hidden = !savedDuration;
      durationTargets.set(card, detect);
      durationObserver.observe(card);
    } else {
      detect();
    }
  }

  function navigateToTvVideo(entry) {
    pendingTvAutoplayEntryId = entry._id;
    navigateGallery({ tab: 'tv', entryId: entry._id });
  }

  function getVideoViews(entry) {
    const count = getVideoViewCount(entry._id);
    return formatViewsLabel(count);
  }

  function getVideoTime(entry) {
    if (entry.timeAgo) return entry.timeAgo;
    const dateType = entry.dateType || (entry.timerStart ? 'system' : (entry.endDate ? 'range' : 'single'));
    if (dateType === 'system') {
      return formatTvRelativeTimer(entry.timerStart || entry.publishedAt || entry._createdAt);
    }
    if (dateType === 'range' && (entry.eventDate || entry.endDate)) {
      return formatTvDateRange(entry.eventDate, entry.endDate);
    }
    if (entry.eventDate) {
      return formatTvSingleDate(entry.eventDate);
    }
    if (entry.publishedAt) {
      return formatTvRelativeTimer(entry.publishedAt);
    }
    return 'Just Recent';
  }

  function getVideoThumbnail(entry) {
    return getTvVideoThumbnail(entry);
  }

  function getVideoAvatar(entry) {
    if (entry.authorAvatar) return safeMediaUrl(entry.authorAvatar);
    return '/images/logo.jpg';
  }

  function getVideoChannel(entry) {
    return entry.author || entry.artistCurator || 'ARTGALZIM TV';
  }

  // -------------------------------------------------------------
  // SEGMENT 3: WATCH VIEW / VIDEO POPUP (when a video is selected)
  // -------------------------------------------------------------
  if (selected) {
    const autoplay = pendingTvAutoplayEntryId === selected._id;
    pendingTvAutoplayEntryId = null;
    if (selectedIsShort) renderShortsWatchView(selected, groups.shorts, autoplay);
    else renderWatchView(selected, allVideos, autoplay);
    return;
  }

  // -------------------------------------------------------------
  // SEGMENT 1 & 2: MAIN FEED (4-Column Grid & Separate Shorts Shelf)
  // -------------------------------------------------------------
  renderFeedView(groups);

  function renderFeedView(groups) {
    const longformEntries = groups.landscape;
    const firstLongform = longformEntries.slice(0, 8);
    const moreLongform = longformEntries.slice(8);

    if (firstLongform.length) {
      const section = document.createElement('section');
      section.className = 'ag-tv-section';
      const grid = document.createElement('div');
      grid.className = 'ag-tv-longform-grid';
      firstLongform.forEach(video => grid.appendChild(createLongformCard(video)));
      section.appendChild(grid);
      layout.appendChild(section);
    }

    const shortEntries = groups.shorts;
    if (shortEntries.length) {
      const shelf = document.createElement('section');
      shelf.className = 'ag-tv-shorts-shelf';

      const header = document.createElement('div');
      header.className = 'ag-tv-shelf-header';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'ag-tv-shelf-title-wrap';

      const icon = document.createElement('img');
      icon.className = 'ag-tv-shorts-logo-badge';
      icon.src = '/images/logo.jpg';
      icon.alt = 'ARTGALZIM Shorts';
      icon.loading = 'lazy';
      titleWrap.appendChild(icon);

      const title = document.createElement('h2');
      title.className = 'ag-tv-shelf-title';
      title.textContent = 'Shorts';
      titleWrap.appendChild(title);
      header.appendChild(titleWrap);
      shelf.appendChild(header);

      const shortsGrid = document.createElement('div');
      shortsGrid.className = 'ag-tv-shorts-grid';
      shortEntries.slice(0, 5).forEach(shortItem => shortsGrid.appendChild(createShortCard(shortItem)));
      shelf.appendChild(shortsGrid);
      layout.appendChild(shelf);
    }

    if (moreLongform.length) {
      const sectionMore = document.createElement('section');
      sectionMore.className = 'ag-tv-section';
      const sectionTitle = document.createElement('h2');
      sectionTitle.className = 'ag-tv-section-title';
      sectionTitle.textContent = 'More from ARTGALZIM TV';
      sectionMore.appendChild(sectionTitle);

      const gridMore = document.createElement('div');
      gridMore.className = 'ag-tv-longform-grid';
      moreLongform.forEach(video => gridMore.appendChild(createLongformCard(video)));
      sectionMore.appendChild(gridMore);
      layout.appendChild(sectionMore);
    }
  }

  function createLongformCard(video) {
    const card = document.createElement('article');
    card.className = 'ag-tv-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Play ${video.title || 'video'}`);

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'ag-tv-thumb-wrap';
    const img = document.createElement('img');
    setTvThumbnail(img, video, '/images/MAIN IMAGES/home/Art Gallery Frontview jpeg.jpeg');
    img.alt = video.title || 'Video thumbnail';
    img.loading = 'lazy';
    applyTvFocalPoint(img, video);
    thumbWrap.appendChild(img);
    if (video.badge) {
      const cardBadge = document.createElement('span');
      cardBadge.className = 'ag-tv-card-badge';
      cardBadge.textContent = video.badge;
      thumbWrap.appendChild(cardBadge);
    }

    const badge = document.createElement('span');
    badge.className = 'ag-tv-duration-badge';
    badge.textContent = getVideoDuration(video);
    thumbWrap.appendChild(badge);
    card.appendChild(thumbWrap);
    observeTvDuration(card, video, badge);

    const metaRow = document.createElement('div');
    metaRow.className = 'ag-tv-meta-row';

    const avatar = document.createElement('img');
    avatar.className = 'ag-tv-avatar';
    avatar.src = getVideoAvatar(video);
    avatar.alt = getVideoChannel(video);
    avatar.loading = 'lazy';
    avatar.addEventListener('error', () => { avatar.src = '/images/logo.jpg'; }, { once: true });
    metaRow.appendChild(avatar);

    const info = document.createElement('div');
    info.className = 'ag-tv-info';

    const title = document.createElement('h3');
    title.className = 'ag-tv-title';
    title.textContent = video.title || 'Untitled Video';
    info.appendChild(title);

    const channelLine = document.createElement('div');
    channelLine.className = 'ag-tv-channel-line';
    const channelName = document.createElement('span');
    channelName.textContent = getVideoChannel(video);
    channelLine.appendChild(channelName);

    const verified = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    verified.setAttribute('class', 'ag-tv-verified-badge');
    verified.setAttribute('viewBox', '0 0 24 24');
    verified.innerHTML = '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.8 14.6l-3.8-3.8 1.4-1.4 2.4 2.4 6-6 1.4 1.4-7.4 7.4z"/>';
    channelLine.appendChild(verified);
    info.appendChild(channelLine);

    const statsLine = document.createElement('div');
    statsLine.className = 'ag-tv-stats-line';
    statsLine.textContent = `${getVideoViews(video)} • ${getVideoTime(video)}`;
    info.appendChild(statsLine);

    metaRow.appendChild(info);
    card.appendChild(metaRow);

    card.addEventListener('click', () => {
      navigateToTvVideo(video);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToTvVideo(video);
      }
    });

    return card;
  }

  function createShortCard(shortItem) {
    const card = document.createElement('article');
    card.className = 'ag-tv-short-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Play Short: ${shortItem.title || 'Short'}`);

    const img = document.createElement('img');
    setTvThumbnail(img, shortItem, '/images/MAIN IMAGES/home/artwork_1.webp');
    img.alt = shortItem.title || 'Short thumbnail';
    img.loading = 'lazy';
    applyTvFocalPoint(img, shortItem);
    card.appendChild(img);

    const badgeText = shortItem.badge || '';
    if (badgeText) {
      const badge = document.createElement('span');
      badge.className = 'ag-tv-short-badge';
      badge.textContent = badgeText;
      card.appendChild(badge);
    }

    const gradient = document.createElement('div');
    gradient.className = 'ag-tv-short-gradient';
    const duration = document.createElement('span');
    duration.className = 'ag-tv-short-duration';
    duration.textContent = getVideoDuration(shortItem);
    gradient.appendChild(duration);
    observeTvDuration(card, shortItem, duration);

    const title = document.createElement('h3');
    title.className = 'ag-tv-short-title';
    title.textContent = shortItem.title || 'Untitled Short';
    gradient.appendChild(title);

    const views = document.createElement('span');
    views.className = 'ag-tv-short-views';
    views.textContent = `${getVideoViews(shortItem)} • ${getVideoTime(shortItem)}`;
    gradient.appendChild(views);
    card.appendChild(gradient);

    card.addEventListener('click', () => {
      navigateToTvVideo(shortItem);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToTvVideo(shortItem);
      }
    });

    return card;
  }

  function renderShortsWatchView(activeVideo, shorts, autoplay) {
    const shortPool = shorts.length ? shorts : [activeVideo];
    const selectedIndex = Math.max(0, shortPool.findIndex(entry => entry._id === activeVideo._id));
    const orderedShorts = [...shortPool.slice(selectedIndex), ...shortPool.slice(0, selectedIndex)];
    const watchView = document.createElement('section');
    watchView.className = 'ag-tv-shorts-watch-view';
    watchView.setAttribute('aria-label', 'ARTGALZIM Shorts player');

    const header = document.createElement('div');
    header.className = 'ag-tv-short-feed-header';
    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'ag-tv-watch-back-btn';
    backButton.setAttribute('aria-label', 'Back to ARTGALZIM TV');
    backButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
    backButton.addEventListener('click', () => navigateGallery({ tab: 'tv', entryId: null }));
    const positionLabel = document.createElement('span');
    positionLabel.className = 'ag-tv-short-feed-position';
    positionLabel.textContent = `1 / ${orderedShorts.length}`;
    header.append(backButton, positionLabel);
    watchView.appendChild(header);

    const shortFeed = document.createElement('div');
    shortFeed.className = 'ag-tv-shorts-watch-feed';
    shortFeed.tabIndex = 0;
    shortFeed.setAttribute('aria-label', 'Scroll vertically to watch more Shorts');
    watchView.appendChild(shortFeed);
    layout.appendChild(watchView);

    let activeSlide = null;
    let observer = null;
    const slides = [];

    function createShortPlayer(entry, muted) {
      const posterUrl = getVideoThumbnail(entry);
      const directUrl = safeMediaUrl(getTvVideoSourceUrl(entry));
      if (directUrl) {
        const download = getSanityVideoDownload(entry);
        return createPremiumVideoPlayer({
          videoUrl: directUrl,
          downloadUrl: download.url,
          downloadSize: download.size,
          posterUrl,
          title: entry.title || 'ARTGALZIM Short',
          autoplay: true,
          muted
        });
      }

      const embed = mediaEmbed(entry.mediaUrl || '', entry.mediaType || 'video');
      if (embed?.kind === 'youtube') {
        const url = new URL(entry.mediaUrl);
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        return createPremiumYouTubePlayer({
          ytId: youtubeVideoId(url, host),
          title: entry.title || 'ARTGALZIM Short',
          posterUrl,
          autoplay: true,
          muteAutoplay: muted
        });
      }

      if (embed?.kind === 'frame') {
        const frame = document.createElement('iframe');
        frame.className = 'ag-tv-short-embed';
        frame.src = embed.src;
        frame.title = entry.title || 'ARTGALZIM Short';
        frame.allow = 'autoplay; encrypted-media; picture-in-picture';
        frame.referrerPolicy = 'strict-origin-when-cross-origin';
        frame.allowFullscreen = true;
        return frame;
      }
      return null;
    }

    function deactivateSlide(slide) {
      if (!slide?._player) return;
      slide._player.querySelector('video')?.pause();
      slide._player.remove();
      slide._player = null;
      slide._frame.insertBefore(slide._poster, slide._overlays);
      slide._frame.insertBefore(slide._playButton, slide._overlays);
      slide._playButton.hidden = false;
    }

    function activateSlide(slide, muted) {
      if (slide._player) return;
      const player = createShortPlayer(slide._entry, muted);
      if (!player) return;
      slide._player = player;
      slide._poster.remove();
      slide._playButton.hidden = true;
      slide._frame.insertBefore(player, slide._overlays);
      recordVideoPlay(slide._entry._id);
      slide._updateViewStat?.();
      currentEntryId = slide._entry._id;
      syncGalleryHistory(true);
      positionLabel.textContent = `${slide._index + 1} / ${orderedShorts.length}`;
    }

    orderedShorts.forEach((entry, index) => {
      const slide = document.createElement('article');
      slide.className = 'ag-tv-short-watch-slide';
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-label', `Short ${index + 1} of ${orderedShorts.length}: ${entry.title || 'Untitled'}`);
      slide._entry = entry;
      slide._index = index;

      const frame = document.createElement('div');
      frame.className = 'ag-tv-short-watch-frame';
      slide._frame = frame;

      const poster = document.createElement('img');
      poster.className = 'ag-tv-short-watch-poster';
      poster.alt = entry.title || 'Short video poster';
      poster.loading = index > 0 ? 'lazy' : 'eager';
      setTvThumbnail(poster, entry, '/images/MAIN IMAGES/home/artwork_1.webp');
      applyTvFocalPoint(poster, entry);
      slide._poster = poster;

      const playButton = document.createElement('button');
      playButton.type = 'button';
      playButton.className = 'ag-tv-short-watch-play';
      playButton.setAttribute('aria-label', `Play ${entry.title || 'Short'}`);
      playButton.innerHTML = '<span aria-hidden="true">▶</span>';
      playButton.addEventListener('click', () => {
        if (activeSlide && activeSlide !== slide) deactivateSlide(activeSlide);
        activeSlide = slide;
        activateSlide(slide, false);
      });
      slide._playButton = playButton;
      frame.append(poster, playButton);

      const overlays = document.createElement('div');
      overlays.className = 'ag-tv-short-overlays';
      slide._overlays = overlays;

      const rail = document.createElement('aside');
      rail.className = 'ag-tv-short-watch-rail';
      rail.setAttribute('aria-label', 'Short actions');
      let isLiked = isVideoLikedByUser(entry._id);
      let isDisliked = false;
      let likes = getVideoLikeCount(entry._id);

      const addRailButton = ({ label, icon, count = '', active = false, onClick }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `ag-tv-short-rail-button${active ? ' is-active' : ''}`;
        button.setAttribute('aria-label', count ? `${label}, ${count}` : label);
        button.setAttribute('aria-pressed', String(active));
        button.innerHTML = `${icon}${count ? `<span class="ag-tv-short-rail-count">${count}</span>` : ''}`;
        button.addEventListener('click', onClick);
        rail.appendChild(button);
        return button;
      };

      const likeButton = addRailButton({
        label: 'Like',
        icon: isLiked ? TV_LIKE_FILLED_SVG : TV_LIKE_OUTLINE_SVG,
        count: formatLikesLabel(likes),
        active: isLiked,
        onClick: () => {
          const result = toggleVideoLike(entry._id);
          isLiked = result.liked;
          likes = result.count;
          if (isLiked) isDisliked = false;
          likeButton.classList.toggle('is-active', isLiked);
          likeButton.setAttribute('aria-pressed', String(isLiked));
          likeButton.setAttribute('aria-label', `Like, ${formatLikesLabel(likes)}`);
          likeButton.innerHTML = `${isLiked ? TV_LIKE_FILLED_SVG : TV_LIKE_OUTLINE_SVG}<span class="ag-tv-short-rail-count">${formatLikesLabel(likes)}</span>`;
          dislikeButton.classList.toggle('is-active', isDisliked);
          dislikeButton.setAttribute('aria-pressed', String(isDisliked));
        }
      });

      const dislikeButton = addRailButton({
        label: 'Dislike',
        icon: TV_DISLIKE_OUTLINE_SVG,
        active: false,
        onClick: () => {
          isDisliked = !isDisliked;
          if (isDisliked && isLiked) {
            const result = toggleVideoLike(entry._id);
            isLiked = false;
            likes = result.count;
            likeButton.classList.remove('is-active');
            likeButton.setAttribute('aria-pressed', 'false');
            likeButton.setAttribute('aria-label', `Like, ${formatLikesLabel(likes)}`);
            likeButton.innerHTML = `${TV_LIKE_OUTLINE_SVG}<span class="ag-tv-short-rail-count">${formatLikesLabel(likes)}</span>`;
          }
          dislikeButton.classList.toggle('is-active', isDisliked);
          dislikeButton.setAttribute('aria-pressed', String(isDisliked));
        }
      });

      const viewStat = document.createElement('span');
      viewStat.className = 'ag-tv-short-rail-stat';
      viewStat.setAttribute('role', 'img');
      const viewIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      viewIcon.setAttribute('viewBox', '0 0 24 24');
      viewIcon.setAttribute('aria-hidden', 'true');
      viewIcon.innerHTML = '<path d="M12 5c-5.5 0-9.7 4.1-11 7 1.3 2.9 5.5 7 11 7s9.7-4.1 11-7c-1.3-2.9-5.5-7-11-7Zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-2a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>';
      const viewCount = document.createElement('span');
      viewCount.className = 'ag-tv-short-rail-count';
      const updateViewStat = () => {
        const label = getVideoViews(entry);
        viewStat.setAttribute('aria-label', label);
        viewCount.textContent = label.replace(/\s+views?$/, '');
      };
      slide._updateViewStat = updateViewStat;
      updateViewStat();
      viewStat.append(viewIcon, viewCount);
      rail.appendChild(viewStat);

      addRailButton({
        label: 'Share',
        icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7a3.2 3.2 0 0 0 0-1.39l7.05-4.11A3 3 0 1 0 15 5c0 .23.03.46.08.68L8.03 9.79a3 3 0 1 0 0 4.42l7.12 4.16A3 3 0 1 0 18 16.08Z"/></svg>',
        onClick: () => openShareModal(entry)
      });

      const directUrl = safeMediaUrl(getTvVideoSourceUrl(entry));
      if (directUrl) {
        addRailButton({
          label: 'Download',
          icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20h14v-2H5v2Zm7-3 6-6h-4V3h-4v8H6l6 6Z"/></svg>',
          onClick: () => {
            const link = document.createElement('a');
            link.href = directUrl;
            link.download = entry.attachmentName || 'artgalzim-short.mp4';
            link.click();
          }
        });
      }
      overlays.appendChild(rail);

      const details = document.createElement('div');
      details.className = 'ag-tv-short-watch-details';
      const channel = document.createElement('div');
      channel.className = 'ag-tv-short-watch-channel';
      const avatar = document.createElement('img');
      avatar.src = getVideoAvatar(entry);
      avatar.alt = '';
      avatar.loading = 'lazy';
      const channelName = document.createElement('span');
      channelName.textContent = getVideoChannel(entry);
      channel.append(avatar, channelName);
      const title = document.createElement('h2');
      title.textContent = entry.title || 'Untitled Short';
      const meta = document.createElement('p');
      meta.className = 'ag-tv-short-watch-meta';
      meta.textContent = [getVideoDuration(entry), getVideoTime(entry)].filter(Boolean).join(' • ');
      details.append(channel, title, meta);

      const description = document.createElement('p');
      description.className = 'ag-tv-short-watch-excerpt';
      description.textContent = entry.excerpt || entry.body || '';
      let descriptionExpanded = false;
      const fullDescription = entry.body && entry.excerpt
        ? document.createElement('p')
        : null;
      if (fullDescription) {
        fullDescription.className = 'ag-tv-short-watch-full-description';
        fullDescription.textContent = entry.body;
        fullDescription.hidden = true;
      }

      const toggleDescription = () => {
        descriptionExpanded = !descriptionExpanded;
        description.classList.toggle('is-expanded', descriptionExpanded);
        description.setAttribute('aria-expanded', String(descriptionExpanded));
        if (fullDescription) fullDescription.hidden = !descriptionExpanded;
        expandButton.setAttribute('aria-expanded', String(descriptionExpanded));
        expandButton.textContent = descriptionExpanded ? 'Less' : 'More';
      };
      if (description.textContent) details.appendChild(description);
      if (fullDescription) details.appendChild(fullDescription);
      const hasDescription = Boolean(entry.excerpt || entry.body);
      const expandButton = document.createElement('button');
      if (hasDescription) {
        description.setAttribute('role', 'button');
        description.tabIndex = 0;
        description.setAttribute('aria-expanded', 'false');
        description.setAttribute('aria-label', 'Expand video description');
        description.addEventListener('click', toggleDescription);
        description.addEventListener('keydown', event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          toggleDescription();
        });
        expandButton.type = 'button';
        expandButton.className = 'ag-tv-short-expand';
        expandButton.setAttribute('aria-expanded', 'false');
        expandButton.textContent = 'More';
        expandButton.addEventListener('click', toggleDescription);
        details.appendChild(expandButton);
      }
      overlays.appendChild(details);
      slide._frame.appendChild(overlays);

      slide._overlays = overlays;
      slide.appendChild(frame);
      shortFeed.appendChild(slide);
      slides.push(slide);
    });

    const initialSlide = slides[0];
    if (autoplay && initialSlide) {
      activeSlide = initialSlide;
      activateSlide(initialSlide, false);
    }

    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(observations => {
        const visibleSlides = observations
          .filter(observation => observation.isIntersecting && observation.intersectionRatio >= 0.68)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
        const nextSlide = visibleSlides[0]?.target;
        if (!nextSlide || nextSlide === activeSlide) return;
        if (activeSlide) deactivateSlide(activeSlide);
        activeSlide = nextSlide;
        activateSlide(nextSlide, true);
      }, { root: shortFeed, threshold: [0.68, 0.85] });
      slides.forEach(slide => observer.observe(slide));
    }

    shortFeed.addEventListener('keydown', event => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      shortFeed.scrollBy({
        top: (event.key === 'ArrowDown' ? 1 : -1) * shortFeed.clientHeight,
        behavior: 'smooth'
      });
    });
  }

  function renderWatchView(activeVideo, videoPool, autoplay = false) {
    recordVideoPlay(activeVideo._id);

    const watchView = document.createElement('div');
    watchView.className = 'ag-tv-watch-view';

    const leftCol = document.createElement('div');
    leftCol.className = 'ag-tv-watch-main';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'ag-tv-watch-back-btn';
    backBtn.innerHTML = `← Back to ARTGALZIM TV`;
    backBtn.addEventListener('click', () => {
      navigateGallery({ tab: 'tv', entryId: null });
    });
    leftCol.appendChild(backBtn);

    const uploadedVideoUrl = activeVideo.fileUrl || activeVideo.attachmentUrl || '';
    const hasUploadedVideo = Boolean(uploadedVideoUrl && /\.(mp4|webm|ogv)$/i.test(activeVideo.attachmentName || uploadedVideoUrl));
    const effectiveVideoUrl = hasUploadedVideo ? uploadedVideoUrl : (activeVideo.mediaUrl || '');

    const currentIndex = (videoPool || []).findIndex(v => v._id === activeVideo._id);
    const prevVideo = currentIndex > 0 ? videoPool[currentIndex - 1] : (videoPool && videoPool.length > 1 ? videoPool[videoPool.length - 1] : null);
    const nextVideo = currentIndex >= 0 && currentIndex < (videoPool || []).length - 1 ? videoPool[currentIndex + 1] : (videoPool && videoPool.length > 1 ? videoPool[0] : null);

    const onNavigate = (targetVideo) => {
      navigateToTvVideo(targetVideo);
    };

    let playerBox;
    if (hasUploadedVideo || (effectiveVideoUrl && /\.(mp4|webm|ogv)$/i.test(effectiveVideoUrl))) {
      const download = getSanityVideoDownload(activeVideo);
      playerBox = createPremiumVideoPlayer({
        videoUrl: effectiveVideoUrl,
        downloadUrl: download.url,
        downloadSize: download.size,
        posterUrl: getVideoThumbnail(activeVideo),
        title: activeVideo.title,
        prevVideo,
        nextVideo,
        onNavigate,
        autoplay: true
      });
    } else {
      let ytId = '';
      try {
        const u = new URL(effectiveVideoUrl);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        ytId = youtubeVideoId(u, host);
      } catch {}
      if (!ytId) ytId = 'ScMzIvxBSi4';

      playerBox = createPremiumYouTubePlayer({
        ytId,
        title: activeVideo.title,
        posterUrl: getVideoThumbnail(activeVideo),
        prevVideo,
        nextVideo,
        onNavigate,
        autoplay
      });
    }
    leftCol.appendChild(playerBox);

    const title = document.createElement('h1');
    title.className = 'ag-tv-watch-title';
    title.textContent = activeVideo.title || 'Untitled video';
    leftCol.appendChild(title);

    const watchBar = document.createElement('div');
    watchBar.className = 'ag-tv-watch-bar';

    const channelMeta = document.createElement('div');
    channelMeta.className = 'ag-tv-channel-meta';

    const avatar = document.createElement('img');
    avatar.className = 'ag-tv-watch-avatar';
    avatar.src = getVideoAvatar(activeVideo);
    avatar.alt = getVideoChannel(activeVideo);
    channelMeta.appendChild(avatar);

    const chanDetails = document.createElement('div');
    chanDetails.className = 'ag-tv-channel-details';

    const chanName = document.createElement('div');
    chanName.className = 'ag-tv-channel-name';
    chanName.textContent = getVideoChannel(activeVideo);
    const verified = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    verified.setAttribute('class', 'ag-tv-verified-badge');
    verified.setAttribute('viewBox', '0 0 24 24');
    verified.innerHTML = '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.8 14.6l-3.8-3.8 1.4-1.4 2.4 2.4 6-6 1.4 1.4-7.4 7.4z"/>';
    chanName.appendChild(verified);
    chanDetails.appendChild(chanName);
    channelMeta.appendChild(chanDetails);

    watchBar.appendChild(channelMeta);

    const actionsBar = document.createElement('div');
    actionsBar.className = 'ag-tv-watch-actions';

    const likeGroup = document.createElement('div');
    likeGroup.className = 'ag-tv-like-group';
    let isLiked = isVideoLikedByUser(activeVideo._id);
    let isDisliked = false;
    let likes = getVideoLikeCount(activeVideo._id);

    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    likeBtn.className = `ag-tv-like-btn${isLiked ? ' is-active' : ''}`;
    likeBtn.setAttribute('aria-label', 'Like');
    likeBtn.innerHTML = `${isLiked ? TV_LIKE_FILLED_SVG : TV_LIKE_OUTLINE_SVG} <span>${formatLikesLabel(likes)}</span>`;

    const likeDivider = document.createElement('div');
    likeDivider.className = 'ag-tv-like-divider';

    const dislikeBtn = document.createElement('button');
    dislikeBtn.type = 'button';
    dislikeBtn.className = 'ag-tv-dislike-btn';
    dislikeBtn.setAttribute('aria-label', 'Dislike');
    dislikeBtn.innerHTML = TV_DISLIKE_OUTLINE_SVG;

    likeBtn.addEventListener('click', () => {
      const res = toggleVideoLike(activeVideo._id);
      isLiked = res.liked;
      likes = res.count;
      isDisliked = false;
      dislikeBtn.classList.remove('is-active');
      dislikeBtn.innerHTML = TV_DISLIKE_OUTLINE_SVG;
      likeBtn.classList.toggle('is-active', isLiked);
      likeBtn.innerHTML = `${isLiked ? TV_LIKE_FILLED_SVG : TV_LIKE_OUTLINE_SVG} <span>${formatLikesLabel(likes)}</span>`;
    });

    dislikeBtn.addEventListener('click', () => {
      isDisliked = !isDisliked;
      dislikeBtn.classList.toggle('is-active', isDisliked);
      dislikeBtn.innerHTML = isDisliked ? TV_DISLIKE_FILLED_SVG : TV_DISLIKE_OUTLINE_SVG;
      if (isDisliked && isLiked) {
        const res = toggleVideoLike(activeVideo._id);
        isLiked = false;
        likes = res.count;
        likeBtn.classList.remove('is-active');
        likeBtn.innerHTML = `${TV_LIKE_OUTLINE_SVG} <span>${formatLikesLabel(likes)}</span>`;
      }
    });

    likeGroup.appendChild(likeBtn);
    likeGroup.appendChild(likeDivider);
    likeGroup.appendChild(dislikeBtn);
    actionsBar.appendChild(likeGroup);

    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'ag-tv-action-pill';
    shareBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg> Share`;
    shareBtn.addEventListener('click', () => {
      openShareModal(activeVideo);
    });
    actionsBar.appendChild(shareBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'ag-tv-action-pill';
    downloadBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg> Download`;
    downloadBtn.addEventListener('click', () => {
      if (effectiveVideoUrl && hasUploadedVideo) {
        const a = document.createElement('a');
        a.href = effectiveVideoUrl;
        a.download = activeVideo.attachmentName || 'artgalzim-video.mp4';
        a.click();
      } else {
        showTvToast('High-definition download available for gallery members');
      }
    });
    actionsBar.appendChild(downloadBtn);

    watchBar.appendChild(actionsBar);
    leftCol.appendChild(watchBar);

    const descBox = document.createElement('div');
    descBox.className = 'ag-tv-watch-desc';
    const descMeta = document.createElement('div');
    descMeta.className = 'ag-tv-desc-meta';
    descMeta.textContent = `${getVideoViews(activeVideo)} • ${getVideoTime(activeVideo)}`;
    descBox.appendChild(descMeta);

    const descTags = document.createElement('div');
    descTags.className = 'ag-tv-desc-tags';
    descTags.textContent = '#ArtGalZim #Domboshava #ContemporaryAfricanArt #ShonaSculpture';
    descBox.appendChild(descTags);

    if (activeVideo.excerpt) {
      const excerpt = document.createElement('p');
      excerpt.className = 'ag-tv-watch-excerpt';
      excerpt.textContent = activeVideo.excerpt;
      descBox.appendChild(excerpt);
    }
    if (activeVideo.body) {
      const details = document.createElement('div');
      details.className = 'ag-tv-watch-details';
      details.textContent = activeVideo.body;
      descBox.appendChild(details);
    }
    if (!activeVideo.excerpt && !activeVideo.body) {
      const placeholder = document.createElement('p');
      placeholder.textContent = 'Welcome to ARTGALZIM TV. Enjoy exclusive gallery features, studio tours, master interviews, and behind-the-scenes access to contemporary African stone sculpture in Domboshava.';
      descBox.appendChild(placeholder);
    }
    leftCol.appendChild(descBox);

    watchView.appendChild(leftCol);

    const rightCol = document.createElement('aside');
    rightCol.className = 'ag-tv-watch-sidebar';

    const chipsRow = document.createElement('div');
    chipsRow.className = 'ag-tv-chips-row';
    const chips = ['All', 'From ARTGALZIM', 'Exhibitions', 'Studio Visits', 'Shorts', 'Recent'];
    let activeChip = 'All';

    chips.forEach(chipName => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `ag-tv-chip${chipName === activeChip ? ' is-active' : ''}`;
      chip.textContent = chipName;
      chip.addEventListener('click', () => {
        chipsRow.querySelectorAll('.ag-tv-chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeChip = chipName;
        updateRecommendedList();
      });
      chipsRow.appendChild(chip);
    });
    rightCol.appendChild(chipsRow);

    const sponsored = document.createElement('div');
    sponsored.className = 'ag-tv-sponsored-box';
    sponsored.innerHTML = `
      <img src="/images/logo.jpg" alt="ARTGALZIM Center" class="ag-tv-sponsored-logo-img" />
      <div class="ag-tv-sponsored-content">
        <h4 class="ag-tv-sponsored-title">Visit ARTGALZIM Center</h4>
        <p class="ag-tv-sponsored-sub">Sponsored • Domboshava Sculpture Gardens</p>
      </div>
      <a href="visit.html" class="ag-tv-sponsored-btn">Plan Visit →</a>
    `;
    rightCol.appendChild(sponsored);

    const recContainer = document.createElement('div');
    recContainer.className = 'ag-tv-rec-list';
    rightCol.appendChild(recContainer);

    function updateRecommendedList() {
      recContainer.replaceChildren();
      const otherVideos = videoPool.filter(v => v._id !== activeVideo._id);
      let filtered = otherVideos;
      if (activeChip === 'From ARTGALZIM') {
        filtered = otherVideos.filter(v => getVideoChannel(v).includes('ARTGALZIM'));
      } else if (activeChip === 'Shorts') {
        filtered = otherVideos.filter(v => getTvVideoOrientation(v) === 'portrait');
      } else if (activeChip === 'Exhibitions') {
        filtered = otherVideos.filter(v => (v.category === 'Exhibitions' || v.title?.toLowerCase().includes('exhibition')));
      } else if (activeChip === 'Studio Visits') {
        filtered = otherVideos.filter(v => (v.category === 'Studio Visits' || v.title?.toLowerCase().includes('studio')));
      }

      const displayList = (filtered.length ? filtered : otherVideos).slice(0, 10);
      displayList.forEach(recVideo => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'ag-tv-rec-item';
        item.setAttribute('aria-label', `Play recommended video: ${recVideo.title || 'Video'}`);

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'ag-tv-rec-thumb-wrap';
        const img = document.createElement('img');
        setTvThumbnail(img, recVideo, '/images/MAIN IMAGES/home/Art Gallery Frontview jpeg.jpeg');
        img.alt = recVideo.title || 'Thumbnail';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
        });
        thumbWrap.appendChild(img);

        const duration = document.createElement('span');
        duration.className = 'ag-tv-rec-duration';
        duration.textContent = getVideoDuration(recVideo);
        thumbWrap.appendChild(duration);
        observeTvDuration(item, recVideo, duration);
        item.appendChild(thumbWrap);

        const meta = document.createElement('div');
        meta.className = 'ag-tv-rec-meta';

        const recTitle = document.createElement('h4');
        recTitle.className = 'ag-tv-rec-title';
        recTitle.textContent = recVideo.title || 'Untitled video';
        meta.appendChild(recTitle);

        const channelLine = document.createElement('div');
        channelLine.className = 'ag-tv-rec-channel';
        channelLine.textContent = getVideoChannel(recVideo);
        meta.appendChild(channelLine);

        const statsLine = document.createElement('div');
        statsLine.className = 'ag-tv-rec-stats';
        statsLine.textContent = `${getVideoViews(recVideo)} • ${getVideoTime(recVideo)}`;
        meta.appendChild(statsLine);

        item.appendChild(meta);

        item.addEventListener('click', () => {
          navigateToTvVideo(recVideo);
        });

        recContainer.appendChild(item);
      });
    }

    updateRecommendedList();
    watchView.appendChild(rightCol);
    layout.appendChild(watchView);
  }
}

function renderJournal() {
  feed.replaceChildren();
  document.body.classList.remove('tv-shorts-watch-active');
  updateJournalTabs();
  if (currentJournalTab === 'tv') {
    renderTv();
    return;
  }
  if (currentEntryId) {
    const entry = journalEntries.find(item => item._id === currentEntryId);
    if (entry && !isTvEntry(entry)) {
      renderEntryDetail(entry);
      return;
    }
    currentEntryId = null;
  }
  if (currentFolderId) {
    const folder = journalFolders.find(item => item._id === currentFolderId);
    if (!folder || isTvSystemFolder(folder)) {
      currentFolderId = null;
      renderJournal();
      return;
    }
    if (pendingFolderLoadId === currentFolderId) {
      showFolderPreloader();
      return;
    }
    const heading = document.createElement('section');
    heading.className = 'journal-folder-heading';
    const folderFrame = document.createElement('section');
    folderFrame.className = 'journal-folder-frame';
    folderFrame.setAttribute('aria-label', `${folder.title || 'Folder'} contents`);
    const parentFolder = journalFolders.find(item => item._id === folder.parentFolderId) || null;
    addButton(heading, parentFolder ? '← Back' : '← All folders', () => {
      navigateBack({ folderId: parentFolder?._id || null, entryId: null });
    }, 'journal-back');
    const breadcrumb = document.createElement('nav');
    breadcrumb.className = 'journal-folder-breadcrumb';
    breadcrumb.setAttribute('aria-label', 'Folder path');
    const ancestors = [];
    const seenFolderIds = new Set([folder._id]);
    let ancestor = parentFolder;
    while (ancestor && !seenFolderIds.has(ancestor._id)) {
      seenFolderIds.add(ancestor._id);
      ancestors.unshift(ancestor);
      ancestor = journalFolders.find(item => item._id === ancestor.parentFolderId) || null;
    }
    const rootCrumb = document.createElement('button');
    rootCrumb.type = 'button';
    rootCrumb.textContent = 'All folders';
    rootCrumb.addEventListener('click', () => navigateGallery({ folderId: null }));
    breadcrumb.appendChild(rootCrumb);
    [...ancestors, folder].forEach((item, index, path) => {
      const separator = document.createElement('span');
      separator.setAttribute('aria-hidden', 'true');
      separator.textContent = '/';
      breadcrumb.appendChild(separator);
      if (index === path.length - 1) {
        const current = addText(breadcrumb, 'span', item.title || 'Untitled folder');
        current.setAttribute('aria-current', 'page');
      } else {
        const crumb = document.createElement('button');
        crumb.type = 'button';
        crumb.textContent = item.title || 'Untitled folder';
        crumb.addEventListener('click', () => navigateGallery({ folderId: item._id }, { loadingFolder: true }));
        breadcrumb.appendChild(crumb);
      }
    });
    heading.appendChild(breadcrumb);
    addText(heading, 'p', folder.category || 'Journal', 'section-eyebrow');
    addText(heading, 'h2', folder.title || 'Untitled folder');
    if (folder.organization) addText(heading, 'p', folder.organization, 'journal-meta');
    if (folder.description) addText(heading, 'p', folder.description);
    folderFrame.appendChild(heading);
    feed.appendChild(folderFrame);
    const childFolders = journalFolders
      .filter(item => !isTvSystemFolder(item) && item.parentFolderId === folder._id)
      .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    if (childFolders.length) {
      const grid = section('Folders', 'journal-folder-section', folderFrame);
      childFolders.forEach(child => renderFolderCard(child, grid));
    }
    const entries = journalEntries
      .filter(entry => !isTvEntry(entry) && entry.folderId === folder._id)
      .sort((a, b) => String(b.eventDate || b.publishedAt || '').localeCompare(String(a.eventDate || a.publishedAt || '')));
    if (entries.length) {
      const grid = document.createElement('div');
      grid.className = 'journal-section journal-cards journal-folder-entries';
      folderFrame.appendChild(grid);
      entries.forEach(entry => renderEntryCard(entry, grid));
    }
    if (!entries.length && !childFolders.length) addText(folderFrame, 'p', 'This folder is empty. Published stories, media, and subfolders will appear here.', 'journal-empty');
    return;
  }
  const folders = journalFolders
    .filter(folder => !isTvSystemFolder(folder))
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  const rootFolders = folders.filter(folder => !folder.parentFolderId);
  if (rootFolders.length) {
    const grid = section('Folders', 'journal-folder-section');
    rootFolders.forEach(folder => renderFolderCard(folder, grid));
  }
  const legacy = [...legacyEntries].sort((a, b) =>
    String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))
  );
  const journalOnlyEntries = journalEntries.filter(entry => !isTvEntry(entry));
  if (journalOnlyEntries.some(entry => !entry.folderId)) {
    const grid = section(folders.length || legacy.length ? 'More from the Gallery' : 'Stories & Media');
    journalOnlyEntries
      .filter(entry => !entry.folderId)
      .forEach(entry => renderEntryCard(entry, grid));
  }
  if (legacy.length) {
    const grid = section(folders.length ? 'More from the Gallery' : 'Stories & Media');
    legacy.forEach(item => grid.appendChild(item._type === 'post' ? renderLegacyPost(item) : renderLegacyMedia(item)));
  }
  if (!rootFolders.length && !legacy.length) addText(feed, 'p', 'No published stories or media yet.', 'journal-empty');
}

async function loadJournal() {
  try {
    const response = await fetch('/api/public-content');
    if (!response.ok) throw new Error('Published content is temporarily unavailable.');
    const result = await response.json();
    const content = result.data || [];
    journalFolders = content.filter(item => item._type === 'journalFolder');
    journalEntries = content.filter(item => item._type === 'journalEntry');
    legacyEntries = content.filter(item => item._type === 'post' || item._type === 'libraryItem');
    updateJournalTabs();
    renderJournal();
  } catch (error) {
    feed.replaceChildren();
    addText(feed, 'p', error.message, 'journal-empty');
  }
}

function restoreGalleryRoute(route) {
  if (!route) return;
  clearTimeout(folderLoadingTimer);
  hideFolderPreloader();
  currentJournalTab = route.tab === 'tv' ? 'tv' : 'journal';
  currentFolderId = route.folderId || null;
  currentEntryId = route.entryId || null;
  pendingFolderLoadId = null;
  galleryHistoryDepth = Number.isInteger(route.depth) ? Math.max(0, route.depth) : 0;
  renderJournal();
}

const initialGalleryRoute = galleryRouteFromLocation();
if (initialGalleryRoute) {
  currentJournalTab = initialGalleryRoute.tab === 'tv' ? 'tv' : 'journal';
  currentFolderId = initialGalleryRoute.folderId || null;
  currentEntryId = initialGalleryRoute.entryId || null;
  galleryHistoryDepth = Number.isInteger(initialGalleryRoute.depth) ? Math.max(0, initialGalleryRoute.depth) : 0;
}
syncGalleryHistory(true);
window.addEventListener('popstate', event => restoreGalleryRoute(galleryRouteFromLocation(event.state)));

document.querySelectorAll('[data-journal-tab]').forEach(button => {
  button.addEventListener('click', () => setJournalTab(button.dataset.journalTab));
  button.addEventListener('keydown', event => {
    const tabs = [...document.querySelectorAll('[data-journal-tab]')];
    const currentIndex = tabs.indexOf(button);
    const nextIndex = event.key === 'ArrowRight' || event.key === 'Home'
      ? (event.key === 'Home' ? 0 : (currentIndex + 1) % tabs.length)
      : event.key === 'ArrowLeft' || event.key === 'End'
        ? (event.key === 'End' ? tabs.length - 1 : (currentIndex - 1 + tabs.length) % tabs.length)
        : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    tabs[nextIndex].focus();
    setJournalTab(tabs[nextIndex].dataset.journalTab);
  });
});
loadJournal();
