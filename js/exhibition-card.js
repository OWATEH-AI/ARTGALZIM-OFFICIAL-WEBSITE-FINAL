(function (global) {
  const fallbackImage = '/images/MAIN IMAGES/exhibitions/artwork_2.webp';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function parseDate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function statusFor(exhibition, now = new Date()) {
    const startDate = parseDate(exhibition.startDate);
    const endDate = parseDate(exhibition.endDate);
    const firstDate = startDate || endDate;
    const lastDate = endDate || startDate;
    if (!firstDate) {
      const status = String(exhibition.status || 'upcoming').toLowerCase();
      return status === 'active' || status === 'current' ? 'current' : status === 'past' ? 'past' : 'upcoming';
    }
    firstDate.setHours(0, 0, 0, 0);
    lastDate.setHours(23, 59, 59, 999);
    if (now < firstDate) return 'upcoming';
    if (now > lastDate) return 'past';
    return 'current';
  }

  function formatDisplayDate(exhibition) {
    const formatDate = value => {
      const date = parseDate(value);
      return date ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    };
    const start = formatDate(exhibition.startDate);
    const end = formatDate(exhibition.endDate);
    const dateText = start && end
      ? (exhibition.startDate === exhibition.endDate ? start : `${start} – ${end}`)
      : start || end || 'Date TBA';
    const timeText = [exhibition.startTime, exhibition.endTime].filter(Boolean).join(' – ');
    return timeText ? `${dateText} · ${timeText}` : dateText;
  }

  function formatBadgeDate(exhibition) {
    if (exhibition.isPlaceholder) return exhibition.timeRange || 'TBA';
    const badgeDate = exhibition.startDate || exhibition.endDate;
    const date = parseDate(badgeDate);
    if (!date) return [exhibition.startTime, exhibition.endTime].filter(Boolean).join(' – ') || 'Date TBA';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function safeImage(value, allowBlob = false) {
    try {
      const url = new URL(value || fallbackImage, global.location.href);
      return ['http:', 'https:'].includes(url.protocol) || (allowBlob && url.protocol === 'blob:')
        ? escapeHtml(url.href)
        : fallbackImage;
    } catch {
      return fallbackImage;
    }
  }

  function safeLink(value) {
    if (!value) return '';
    try {
      const url = new URL(value, global.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.href) : '';
    } catch {
      return '';
    }
  }

  function renderDetails(exhibition) {
    const fields = [
      exhibition.artist && `<p><strong>Artist / Curator:</strong> ${escapeHtml(exhibition.artist)}</p>`,
      exhibition.category && `<p><strong>Category:</strong> ${escapeHtml(exhibition.category)}</p>`,
      exhibition.location && `<p><strong>Location:</strong> ${escapeHtml(exhibition.location)}</p>`,
      exhibition.theme && `<p><strong>Theme:</strong> ${escapeHtml(exhibition.theme)}</p>`,
      exhibition.description && `<p><strong>Description:</strong> ${escapeHtml(exhibition.description)}</p>`,
      exhibition.conditions && `<p><strong>Conditions / additional details:</strong><br>${escapeHtml(exhibition.conditions).replace(/\n/g, '<br>')}</p>`
    ].filter(Boolean);
    return fields.length
      ? `<details class="exh-details"><summary>View details</summary><div class="exh-details-content">${fields.join('')}</div></details>`
      : '';
  }

  function renderCta(exhibition) {
    const href = safeLink(exhibition.registrationLink || exhibition.contactLink);
    if (!href) return '';
    const targetAttrs = exhibition.registrationLink ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}" class="exh-cta"${targetAttrs}>${escapeHtml(exhibition.ctaText || 'Learn More')}</a>`;
  }

  function render(exhibition) {
    const status = exhibition.status || statusFor(exhibition);
    const badgeClass = status === 'current' ? 'now' : status === 'past' ? 'past' : 'soon';
    const displayDate = formatDisplayDate(exhibition);
    const badgeDate = formatBadgeDate(exhibition);
    const image = safeImage(exhibition.image, exhibition.allowBlobImage === true);
    const title = escapeHtml(exhibition.title || 'Untitled Exhibition');
    const focusX = Number(exhibition.imagePosition?.x);
    const focusY = Number(exhibition.imagePosition?.y);
    const imagePosition = `${Number.isFinite(focusX) ? Math.max(0, Math.min(100, focusX)) : 50}% ${Number.isFinite(focusY) ? Math.max(0, Math.min(100, focusY)) : 50}%`;

    if (exhibition.isPlaceholder) {
      const finalDisplayDate = exhibition.displayDateOverride || displayDate;
      return `
        <article class="exh-card exh-card--placeholder">
          <div class="exh-img-frame exh-img-frame--dark" style="position:relative; overflow:hidden;">
            <img src="${image}" alt="${title}" style="position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; object-position:${imagePosition}; z-index:0; filter: brightness(0.35);">
            <div class="exh-coming-soon" style="position:absolute; inset:0; z-index:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding: 1rem;">
              <span style="font-size:1.6rem; font-family:'Cormorant Garamond', serif; font-weight:700; color:#fff; text-shadow: 0 4px 10px rgba(0,0,0,0.8); letter-spacing:0.05em; line-height:1.2;">More exhibitions</span>
              <span style="font-size:1rem; font-weight:600; color:var(--gold); text-shadow: 0 2px 6px rgba(0,0,0,0.8); margin-top:0.5rem; letter-spacing:0.15em; text-transform:uppercase;">coming soon</span>
            </div>
          </div>
          <div class="exh-body">
            <span class="exh-dates">${escapeHtml(finalDisplayDate)}</span>
            <h3 class="exh-title">${title}</h3>
            <p class="exh-participants">${escapeHtml(exhibition.category || '')} &nbsp;·&nbsp; ${escapeHtml(exhibition.artist || '')}</p>
            ${exhibition.theme ? `<p class="exh-participants">Theme: ${escapeHtml(exhibition.theme)}</p>` : ''}
            <p class="exh-desc">${escapeHtml(exhibition.description || '')}</p>
            ${renderDetails(exhibition)}
            ${renderCta(exhibition)}
          </div>
        </article>`;
    }

    const feeText = exhibition.registrationFee ? `<br>Registration Fee: ${escapeHtml(exhibition.registrationFee)}` : '';
    return `
      <article class="exh-card" data-id="${escapeHtml(exhibition.id || '')}">
        <div class="exh-img-frame">
          <img src="${image}" alt="${title}" loading="lazy" style="object-position:${imagePosition};">
          <div class="exh-badge ${badgeClass}">${escapeHtml(badgeDate)}</div>
        </div>
        <div class="exh-body">
          <span class="exh-dates">${escapeHtml(displayDate)}</span>
          <h3 class="exh-title">${title}</h3>
          <p class="exh-participants">${escapeHtml(exhibition.category || '')} &nbsp;·&nbsp; ${escapeHtml(exhibition.artist || '')}</p>
          ${exhibition.theme ? `<p class="exh-participants">Theme: ${escapeHtml(exhibition.theme)}</p>` : ''}
          <p class="exh-desc">${escapeHtml(exhibition.description || '')}${feeText}</p>
          ${renderDetails(exhibition)}
          ${renderCta(exhibition)}
        </div>
      </article>`;
  }

  global.ExhibitionCardRenderer = Object.freeze({ render, statusFor });
})(window);