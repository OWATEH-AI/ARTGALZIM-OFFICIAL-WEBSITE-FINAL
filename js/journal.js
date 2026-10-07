const feed = document.getElementById('journalFeed');
let journalFolders = [];
let journalEntries = [];
let legacyEntries = [];
let currentFolderId = null;
let currentEntryId = null;
let currentJournalTab = 'journal';

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

function addMediaViewer(parent, mediaUrl, mediaType, title, className = 'journal-media-viewer', posterUrl = '', directVideoAsset = false) {
  const embed = mediaEmbed(mediaUrl, mediaType, directVideoAsset);
  if (!embed) return false;
  const viewer = document.createElement('div');
  viewer.className = className;
  if (embed.kind === 'video') {
    const video = document.createElement('video');
    video.src = embed.src;
    video.poster = safeMediaUrl(posterUrl);
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', title || 'Journal video');
    viewer.appendChild(video);
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
    playLabel.className = 'journal-video-preview-label';
    playLabel.textContent = 'Play video';
    preview.append(playLabel);
    preview.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      frame.src = embed.src;
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
  currentJournalTab = tab === 'tv' ? 'tv' : 'journal';
  currentEntryId = null;
  currentFolderId = null;
  updateJournalTabs();
  renderJournal();
}

function section(title, className = '') {
  const wrapper = document.createElement('section');
  wrapper.className = `journal-section ${className}`.trim();
  addText(wrapper, 'h2', title);
  const grid = document.createElement('div');
  grid.className = 'journal-cards';
  wrapper.appendChild(grid);
  feed.appendChild(wrapper);
  return grid;
}

function renderFolderCard(folder, target) {
  const card = document.createElement('article');
  card.className = 'journal-item journal-folder';
  const coverUrl = safeMediaUrl(folder.coverUrl);
  if (coverUrl) {
    const image = document.createElement('img');
    image.src = coverUrl;
    image.alt = folder.title ? `${folder.title} folder cover` : 'Journal folder cover';
    image.loading = 'lazy';
    card.appendChild(image);
  }
  addText(card, 'p', folder.category || 'Journal', 'section-eyebrow');
  addText(card, 'h3', folder.title || 'Untitled folder');
  if (folder.organization) addText(card, 'p', folder.organization, 'journal-meta');
  if (folder.description) addText(card, 'p', folder.description);
  const count = journalEntries.filter(entry => !isTvEntry(entry) && entry.folderId === folder._id).length;
  addText(card, 'p', `${count} ${count === 1 ? 'story' : 'stories'}`, 'journal-meta');
  addButton(card, 'Open folder', () => {
    currentFolderId = folder._id;
    currentEntryId = null;
    renderJournal();
  });
  target.appendChild(card);
}

function renderEntryCard(entry, target) {
  const card = document.createElement('article');
  card.className = 'journal-item';
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
  const meta = [dateLabel, entry.location].filter(Boolean).join(' · ');
  if (meta) addText(card, 'p', meta, 'journal-meta');
  if (entry.excerpt) addText(card, 'p', entry.excerpt);
  addButton(card, ['video', 'social', 'document'].includes(entry.mediaType) ? 'Watch / view' : 'Read more', () => {
    currentEntryId = entry._id;
    renderJournal();
  });
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
    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.preload = 'metadata';
    article.insertBefore(video, article.querySelector('h3'));
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
    currentEntryId = null;
    renderJournal();
  }, 'journal-back');
  addText(article, 'p', entry.entryType || 'Story', 'section-eyebrow');
  addText(article, 'h2', entry.title || 'Untitled story');
  const dateLabel = formatDate(entry.eventDate || entry.publishedAt);
  const dates = [dateLabel, formatDate(entry.endDate)].filter(Boolean).join(' – ');
  const meta = [dates, entry.location, entry.author ? `By ${entry.author}` : ''].filter(Boolean).join(' · ');
  if (meta) addText(article, 'p', meta, 'journal-meta');
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
  if (mediaUrl && !addMediaViewer(article, mediaUrl, mediaType, entry.title, 'journal-media-viewer', entry.imageUrl)) {
    addText(article, 'p', 'This media link cannot be embedded. Please contact the gallery for access.', 'journal-meta');
  }
  if (entry.excerpt) addText(article, 'p', entry.excerpt, 'journal-detail-excerpt');
  if (entry.body) addText(article, 'p', entry.body, 'journal-detail-body');
  const attachmentUrl = safeMediaUrl(entry.fileUrl || entry.attachmentUrl);
  if (attachmentUrl) {
    const attachmentName = entry.attachmentName || '';
    if (/\.pdf$/i.test(attachmentName)) {
      addMediaViewer(article, attachmentUrl, 'document', entry.title, 'journal-document-viewer');
    } else if (/\.(mp4|webm|ogv)$/i.test(attachmentName)) {
      addMediaViewer(article, attachmentUrl, 'video', entry.title, 'journal-media-viewer', entry.imageUrl, true);
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

function renderTv() {
  const videos = journalEntries
    .filter(entry => isTvEntry(entry) && ['video', 'social'].includes(entry.mediaType)
      && (entry.mediaUrl || (entry.mediaType === 'video' && (entry.fileUrl || entry.attachmentUrl))))
    .sort((a, b) => String(b.eventDate || b.publishedAt || '').localeCompare(String(a.eventDate || a.publishedAt || '')));
  if (!videos.length) {
    addText(feed, 'p', 'No ARTGALZIM TV videos have been published yet.', 'journal-empty');
    return;
  }

  const selected = videos.find(entry => entry._id === currentEntryId) || videos[0];
  const uploadedVideoUrl = selected.fileUrl || selected.attachmentUrl || '';
  const uploadedVideo = Boolean(uploadedVideoUrl && /\.(mp4|webm|ogv)$/i.test(selected.attachmentName || ''));
  const selectedVideoUrl = uploadedVideo ? uploadedVideoUrl : selected.mediaUrl;
  const layout = document.createElement('div');
  layout.className = 'journal-tv-layout';
  const player = document.createElement('article');
  player.className = 'journal-tv-player';
  const playlist = document.createElement('aside');
  playlist.className = 'journal-tv-playlist';
  playlist.setAttribute('aria-label', 'ARTGALZIM TV playlist');
  feed.append(layout);
  layout.append(player, playlist);

  if (!addMediaViewer(player, selectedVideoUrl, selected.mediaType, selected.title, 'journal-tv-viewer', selected.imageUrl, uploadedVideo)) {
    addText(player, 'p', 'This video could not be embedded. Check that it is public and supports embedding.', 'journal-meta');
  }
  addText(player, 'h2', selected.title || 'Untitled video');
  const meta = [formatDate(selected.eventDate || selected.publishedAt), selected.location].filter(Boolean).join(' · ');
  if (meta) addText(player, 'p', meta, 'journal-meta');
  if (selected.excerpt) addText(player, 'p', selected.excerpt, 'journal-detail-excerpt');
  if (selected.body) addText(player, 'p', selected.body, 'journal-detail-body');

  addText(playlist, 'h2', 'ARTGALZIM TV');
  addText(playlist, 'p', `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`, 'journal-meta');
  const list = document.createElement('div');
  list.className = 'journal-tv-playlist-items';
  playlist.appendChild(list);
  videos.forEach((entry, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'journal-tv-playlist-item';
    item.setAttribute('aria-current', String(entry._id === selected._id));
    const videoEmbed = entry.mediaType === 'video' && entry.mediaUrl ? mediaEmbed(entry.mediaUrl, 'video') : null;
    const imageUrl = safeMediaUrl(entry.imageUrl) || videoEmbed?.thumbnails?.[0] || '';
    if (imageUrl) {
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = '';
      image.loading = 'lazy';
      const thumbnailSources = videoEmbed?.thumbnails || [];
      let thumbnailIndex = thumbnailSources.indexOf(imageUrl);
      image.addEventListener('error', () => {
        thumbnailIndex += 1;
        if (thumbnailIndex >= 0 && thumbnailIndex < thumbnailSources.length) {
          image.src = thumbnailSources[thumbnailIndex];
        } else {
          const number = document.createElement('span');
          number.className = 'journal-tv-playlist-number';
          number.textContent = String(index + 1).padStart(2, '0');
          image.replaceWith(number);
        }
      });
      item.appendChild(image);
    } else {
      const number = document.createElement('span');
      number.className = 'journal-tv-playlist-number';
      number.textContent = String(index + 1).padStart(2, '0');
      item.appendChild(number);
    }
    const text = document.createElement('span');
    text.className = 'journal-tv-playlist-text';
    addText(text, 'strong', entry.title || 'Untitled video');
    const date = formatDate(entry.eventDate || entry.publishedAt);
    if (date) addText(text, 'span', date, 'journal-meta');
    item.appendChild(text);
    item.addEventListener('click', () => {
      currentEntryId = entry._id;
      renderJournal();
    });
    list.appendChild(item);
  });
}

function renderJournal() {
  feed.replaceChildren();
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
    if (!folder) {
      currentFolderId = null;
      renderJournal();
      return;
    }
    const heading = document.createElement('section');
    heading.className = 'journal-folder-heading';
    addButton(heading, 'All folders', () => {
      currentFolderId = null;
      renderJournal();
    }, 'journal-back');
    addText(heading, 'p', folder.category || 'Journal', 'section-eyebrow');
    addText(heading, 'h2', folder.title || 'Untitled folder');
    if (folder.organization) addText(heading, 'p', folder.organization, 'journal-meta');
    if (folder.description) addText(heading, 'p', folder.description);
    feed.appendChild(heading);
    const entries = journalEntries
      .filter(entry => !isTvEntry(entry) && entry.folderId === folder._id)
      .sort((a, b) => String(b.eventDate || b.publishedAt || '').localeCompare(String(a.eventDate || a.publishedAt || '')));
    if (!entries.length) addText(feed, 'p', 'No published stories in this folder yet.', 'journal-empty');
    else {
      const grid = document.createElement('div');
      grid.className = 'journal-cards';
      feed.appendChild(grid);
      entries.forEach(entry => renderEntryCard(entry, grid));
    }
    return;
  }
  const folders = [...journalFolders].sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  if (folders.length) {
    const grid = section('Folders');
    folders.forEach(folder => renderFolderCard(folder, grid));
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
  if (!folders.length && !legacy.length) addText(feed, 'p', 'No published stories or media yet.', 'journal-empty');
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
