import { getTvVideoOrientation, groupTvVideos } from './tv-layout.js';

const feed = document.getElementById('journalFeed');
let journalFolders = [];
let journalEntries = [];
let legacyEntries = [];
let currentFolderId = null;
let currentEntryId = null;
let currentJournalTab = 'journal';
let pendingFolderLoadId = null;
let folderLoadingTimer = null;
let galleryHistoryDepth = 0;
let folderPreloaderActive = false;

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
      if (!addMediaViewer(mediaColumn, mediaUrl, mediaType, entry.title, 'journal-media-viewer', imageUrls[0])) {
        addText(mediaColumn, 'p', 'This media link cannot be embedded. Please contact the gallery for access.', 'journal-meta');
      }
    }
    const attachmentUrl = safeMediaUrl(entry.fileUrl || entry.attachmentUrl);
    if (attachmentUrl) {
      const attachmentName = entry.attachmentName || '';
      if (/\.pdf$/i.test(attachmentName)) {
        addMediaViewer(mediaColumn, attachmentUrl, 'document', entry.title, 'journal-document-viewer');
      } else if (/\.(mp4|webm|ogv)$/i.test(attachmentName)) {
        addMediaViewer(mediaColumn, attachmentUrl, 'video', entry.title, 'journal-media-viewer', imageUrls[0], true);
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
  if (mediaUrl && !addMediaViewer(article, mediaUrl, mediaType, entry.title, 'journal-media-viewer', entry.imageUrl)) {
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

  const groups = groupTvVideos(videos);
  const selected = videos.find(entry => entry._id === currentEntryId)
    || groups.landscape[0]
    || groups.shorts[0];
  const selectedOrientation = getTvVideoOrientation(selected);
  const selectedShape = selectedOrientation === 'portrait' ? 'short' : 'landscape';
  const uploadedVideoUrl = selected.fileUrl || selected.attachmentUrl || '';
  const uploadedVideo = Boolean(uploadedVideoUrl && /\.(mp4|webm|ogv)$/i.test(selected.attachmentName || ''));
  const selectedVideoUrl = uploadedVideo ? uploadedVideoUrl : selected.mediaUrl;
  const layout = document.createElement('div');
  layout.className = 'journal-tv-layout';
  const player = document.createElement('article');
  player.className = `journal-tv-player is-${selectedShape}`;
  feed.append(layout);
  layout.append(player);

  if (!addMediaViewer(
    player,
    selectedVideoUrl,
    selected.mediaType,
    selected.title,
    `journal-tv-viewer is-${selectedShape}`,
    selected.imageUrl,
    uploadedVideo
  )) {
    addText(player, 'p', 'This video could not be embedded. Check that it is public and supports embedding.', 'journal-meta');
  }
  addText(player, 'h2', selected.title || 'Untitled video');
  const meta = [formatDate(selected.eventDate || selected.publishedAt), selected.location].filter(Boolean).join(' · ');
  if (meta) addText(player, 'p', meta, 'journal-meta');
  if (selected.excerpt) addText(player, 'p', selected.excerpt, 'journal-detail-excerpt');
  if (selected.body) addText(player, 'p', selected.body, 'journal-detail-body');

  function renderVideoSection(title, entries, isShorts) {
    if (!entries.length) return;
    const section = document.createElement('section');
    section.className = `journal-tv-section${isShorts ? ' is-shorts' : ''}`;
    addText(section, 'h2', title);
    const cards = document.createElement('div');
    cards.className = `journal-tv-cards${isShorts ? ' journal-tv-shorts-row' : ''}`;
    section.appendChild(cards);
    layout.appendChild(section);
    entries.forEach(entry => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `journal-tv-card${isShorts ? ' is-short' : ''}`;
      item.setAttribute('aria-label', `Play ${isShorts ? 'Short' : 'video'}: ${entry.title || 'Untitled video'}`);
      item.setAttribute('aria-current', String(entry._id === selected._id));
      const videoEmbed = entry.mediaType === 'video' && entry.mediaUrl ? mediaEmbed(entry.mediaUrl, 'video') : null;
      const imageUrl = safeMediaUrl(entry.imageUrl) || videoEmbed?.thumbnails?.[0] || '';
      const thumbnail = document.createElement('span');
      thumbnail.className = 'journal-tv-card-thumbnail';
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.addEventListener('error', () => image.remove(), { once: true });
        thumbnail.appendChild(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'journal-tv-card-placeholder';
        placeholder.textContent = isShorts ? 'SHORT' : 'ARTGALZIM TV';
        thumbnail.appendChild(placeholder);
      }
      item.appendChild(thumbnail);
      const text = document.createElement('span');
      text.className = 'journal-tv-card-text';
      addText(text, 'strong', entry.title || 'Untitled video');
      const date = formatDate(entry.eventDate || entry.publishedAt);
      if (date) addText(text, 'span', date, 'journal-meta');
      item.appendChild(text);
      item.addEventListener('click', () => {
        currentEntryId = entry._id;
        renderJournal();
      });
      cards.appendChild(item);
    });
  }

  renderVideoSection('Videos', groups.landscape, false);
  renderVideoSection('Shorts', groups.shorts, true);
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
      .filter(item => item.parentFolderId === folder._id)
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
  const folders = [...journalFolders].sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
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
