/* =============================================
   ARTGALZIM CENTER — Main JavaScript
   Premium African Art Gallery Website
============================================= */

(function () {
  "use strict";

  // ---- Master Artwork Metadata Lookup ----
  // This serves as the source of truth for detailed artworks when they are clicked from dynamic collections.
  const MASTER_ARTWORK_METADATA = {
    // KEITH ZENDA
    "blood-stained veil": {
      medium: "Mixed media on canvas",
      size: "100x120cm",
      year: "2026",
      desc: "An intense abstract work dominated by a deep red, textured fabric‑like form that appears torn and dripping, set against a gradient background that shifts from fiery red to warm peach tones fading into darkness. The thick impasto suggests blood‑soaked cloth, evoking themes of violence, suffering, and the raw physicality of pain, while the dripping strokes imply wounds and loss, inviting viewers to contemplate anguish and resilience."
    },
    "chitenge": {
      medium: "Mixed media on canvas",
      size: "135x165cm",
      year: "2026",
      desc: "This mixed‑media painting portrays the suffering of young and elderly women during the slavery period. A smooth, red‑painted fabric resembling a woman’s garment (veil/clothes) symbolizes the blood‑stained attire of enslaved women who endured brutality, perished in childbirth, or died along the journey. The intact red fabric against a dark‑to‑light gradient background conveys the physical and emotional scars of these women, highlighting their resilience and the enduring legacy of their experience in slavery."
    },
    "red ascendant": {
      medium: "Mixed media on canvas",
      size: "120x100cm",
      year: "2026",
      desc: "An expressive abstract work featuring a bold, textured red form that dominates the canvas, evoking a sense of movement and energy. The vibrant scarlet shape, rendered with thick impasto strokes, rises against a gradient background that shifts from deep black‑gray to luminous yellow‑white, suggesting tension between intensity and illumination. The layered brushwork invites viewers to interpret the dynamic interplay of form and emotion within the composition."
    },
    "goho": {
      medium: "Oil on canvas",
      size: "90x60cm",
      year: "2025",
      desc: "A stunning celebration of harvest, depicting agricultural abundance and cultural heritage through precise oil technique."
    },
    "harvest": {
      medium: "Oil on canvas",
      size: "90x60cm",
      year: "2025",
      desc: "A stunning celebration of harvest, depicting agricultural abundance and cultural heritage through precise oil technique."
    },
    "malume": {
      medium: "Oil on canvas",
      size: "160x85cm",
      year: "2026",
      desc: "A commanding portrait of an elder, capturing wisdom and history through heavy impasto and realistic features."
    },
    "sekuru": {
       medium: "Oil on canvas",
       size: "160x85cm",
       year: "2026",
       desc: "A commanding portrait of an elder, capturing wisdom and history through heavy impasto and realistic features."
    },
    "musha": {
      medium: "Oil on canvas",
      size: "167x116cm",
      year: "2026",
      desc: "Musha mukadzi — celebrating the strength and central role of women in the home and society."
    },
    "mukadzi": {
       medium: "Oil on canvas",
       size: "167x116cm",
       year: "2026",
       desc: "Musha mukadzi — celebrating the strength and central role of women in the home and society."
    },
    "nyika": {
      medium: "Oil on canvas",
      size: "Price on request",
      year: "2025",
      desc: "A deep exploration of spiritual landscapes and the essence of the Earth."
    },
    "sunset": {
      medium: "Oil on canvas",
      size: "Oil on canvas",
      year: "2026",
      desc: "Captured moments at dusk, reflecting the warmth and shift of light across the landscape."
    },
    // WILLARD MAGIGA
    "tariro": {
      medium: "Oils on Canvas",
      size: "90x60cm",
      year: "2025",
      desc: "\"Tariro/Hope\" is a powerful emotional and psychological state that involves a feeling of expectation and desire for a certain thing to happen – usually something positive in the future. It’s like having a spark that drives people to keep going, even when things get tough. In the context of this painting, the artwork blend vibrant colors in the headwrap, symbolizing optimism, energy, and renewal. The woman’s confident gaze and bright attire suggest resilience and forward-looking positivity."
    },
    "hope": {
      medium: "Oils on Canvas",
      size: "90x60cm",
      year: "2025",
      desc: "\"Tariro/Hope\" is a powerful emotional and psychological state that involves a feeling of expectation and desire for a certain thing to happen – usually something positive in the future. It’s like having a spark that drives people to keep going, even when things get tough. In the context of this painting, the artwork blend vibrant colors in the headwrap, symbolizing optimism, energy, and renewal. The woman’s confident gaze and bright attire suggest resilience and forward-looking positivity."
    },
    "chidochashe": {
      medium: "Oils on Canvas",
      size: "90x60cm",
      year: "2026",
      desc: "Chidochashe portrays a young woman whose calm, self-possessed gaze is set against a luminous blue ground. Her sculpted face is rendered with refined realism, while the vibrant headwrap erupts in expressive strokes of red, gold, and ochre, suggesting vitality, resilience, and inner strength. Magiga contrasts precision with painterly freedom, allowing colour and gesture to convey emotion beyond likeness. The composition balances elegance and power, presenting the sitter as both contemporary and timeless. Chidochashe—a name associated with hope—becomes a quiet affirmation of dignity, confidence, and forward-looking resolve."
    },
    "yevedzai": {
      medium: "Oils on Canvas",
      size: "90x60cm",
      year: "2026",
      desc: "Yevedzai presents a poised female figure whose steady gaze conveys dignity, self-awareness, and quiet authority. Set against a muted violet ground, the portrait is animated by expressive strokes of yellow, blue, and soft earth tones that flow through her headwrap and garment, suggesting movement, energy, and inner life. Magiga balances realism in the face with painterly abstraction in the surrounding forms, allowing emotion to emerge through colour and texture rather than narrative. The subject appears both contemporary and timeless, embodying strength, elegance, and cultural pride while inviting the viewer into a moment of calm, reflective presence."
    },
    // FLORAH MAPHOSA
    "spiritual guardian": {
      medium: "Acrylic and oil on canvas",
      size: "140cm x 100",
      year: "2025",
      desc: "A powerful guardian figure embodying spiritual protection and maternal strength, rendered in Maphosa's signature mixed media style."
    },
    "heritage unwrapped": {
      medium: "Mixed media",
      size: "125x85",
      year: "2026",
      desc: "Unfolding layers of history and identity, this piece explores the depth of African cultural heritage."
    },
    "heron": {
      medium: "Oil on Canvas",
      size: "85x75",
      year: "2025",
      desc: "A graceful companion piece exploring the relationship between humans and nature."
    },
    "heroin": {
      medium: "Oil on Canvas",
      size: "85x75",
      year: "2025",
      desc: "A graceful companion piece exploring the relationship between humans and nature."
    }
  };

  // Disable scrolling while preloader is active to prevent background scrolling/glitching
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";

  window.addEventListener("load", () => {
    // We allow a slightly shorter but still premium delay to improve perceived speed on slower networks
    setTimeout(() => {
      const pre = document.getElementById("preloader");
      if (pre) {
        pre.classList.add("hidden");
        // Re-enable scrolling
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
        
        // Trigger a tiny scroll or resize to wake up IntersectionObservers on mobile
        setTimeout(() => {
          window.dispatchEvent(new Event('scroll'));
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }
    }, 1800); // Reduced from 2200 to 1800 for better perceived speed
  });

  // Custom cursor removed (User requested original browser cursor)

  // ---- Theme Toggle ----
  const themeToggle = document.getElementById("themeToggle");
  const html = document.documentElement;
  const savedTheme = localStorage.getItem("ag-theme") || "dark";
  html.setAttribute("data-theme", savedTheme);
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = html.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", next);
      localStorage.setItem("ag-theme", next);
    });
  }

  // ---- Navbar Scroll ----
  const navbar = document.getElementById("navbar");
  if (navbar) {
    window.addEventListener(
      "scroll",
      () => {
        navbar.classList.toggle("scrolled", window.scrollY > 40);
      },
      { passive: true },
    );
  }

  // ---- Sidebar Drawer Toggle ----
  const panelToggle = document.getElementById("panelToggle");
  const rightSidebar = document.getElementById("rightSidebar");
  const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");
  const mobileOverlay = document.getElementById("mobileOverlay");

  function closeDrawer() {
    if (rightSidebar) rightSidebar.classList.remove("open");
    if (mobileOverlay) mobileOverlay.classList.remove("active");
    if (panelToggle) panelToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  function openDrawer() {
    if (rightSidebar) rightSidebar.classList.add("open");
    if (mobileOverlay) mobileOverlay.classList.add("active");
    if (panelToggle) panelToggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  if (panelToggle) {
    panelToggle.addEventListener("click", () => {
      const isOpen = rightSidebar && rightSidebar.classList.contains("open");
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  }
  if (sidebarCloseBtn) sidebarCloseBtn.addEventListener("click", closeDrawer);
  if (mobileOverlay) mobileOverlay.addEventListener("click", closeDrawer);

  document
    .querySelectorAll(".sidebar-nav-link")
    .forEach((l) => l.addEventListener("click", closeDrawer));

  // ---- Hero Slider ----
  const heroSlidesContainer = document.getElementById("hero-slides");
  let slides = [];
  let currentSlide = 0, slideTimer;

  function initHeroSlider() {
    if (!heroSlidesContainer) return;
    
    // Get images from HERO ANIMATION via PageGalleries with a small delay if not ready
    if (!window.PageGalleries && !window.heroRetryCount) {
      window.heroRetryCount = 0;
    }
    
    if (!window.PageGalleries && window.heroRetryCount < 10) {
      window.heroRetryCount++;
      setTimeout(initHeroSlider, 100);
      return;
    }

    const images = (window.PageGalleries && window.PageGalleries.hero) || [];
    
    if (images.length === 0) {
      // Fallback if no images in HERO ANIMATION folder
      const fallback = ['/images/artwork_1.webp', '/images/domboshava.webp', '/images/hero_gallery.webp'];
      fallback.forEach((src, idx) => {
        const slide = document.createElement("div");
        slide.className = `hero-slide ${idx === 0 ? 'active' : ''}`;
        slide.style.backgroundImage = `url('${src}')`;
        heroSlidesContainer.appendChild(slide);
      });
    } else {
      // Clear container first in case of retry
      heroSlidesContainer.innerHTML = '';
      images.forEach((img, idx) => {
        const slide = document.createElement("div");
        slide.className = "hero-slide";
        
        // Add specific positioning classes based on filename
        const lowerImg = img.toLowerCase();
        if (lowerImg.includes("mwana")) slide.classList.add("focus-face");
        if (lowerImg.includes("musha mukadzi")) slide.classList.add("focus-face");
        if (lowerImg.includes("tariro")) slide.classList.add("focus-face");
        if (lowerImg.includes("yevedzai")) slide.classList.add("focus-face");
        if (lowerImg.includes("chitenge")) slide.classList.add("focus-face");
        if (lowerImg.includes("red ascendant")) slide.classList.add("focus-face");
        if (lowerImg.includes("art gallery frontview")) slide.classList.add("focus-center");
        
        // Handle absolute paths starting with /
        const parts = img.split('/');
        const encParts = parts.map(p => p ? encodeURIComponent(p) : '');
        const encImg = encParts.join('/');
        
        slide.style.backgroundImage = `url('${encImg}')`;
        if (idx === 0) slide.classList.add("active");
        heroSlidesContainer.appendChild(slide);
      });
    }

    slides = document.querySelectorAll(".hero-slide");
    if (slides.length) startSlider();
  }

  function goToSlide(n) {
    if (slides.length <= 1) return;
    
    const prevIndex = currentSlide;
    currentSlide = (n + slides.length) % slides.length;
    if (prevIndex === currentSlide) return;
    
    const lastActive = slides[prevIndex];
    const nextActive = slides[currentSlide];

    // Layer 20: Keep the current slide visible as a stable floor
    slides.forEach(s => s.classList.remove("prev-slide"));
    lastActive.classList.add("prev-slide");
    lastActive.classList.remove("active"); 
    
    // Layer 30: Fade in the new slide on top (3s transition)
    nextActive.classList.remove("prev-slide"); // Safety
    nextActive.classList.add("active");

    // Clean Layer 20 after 4s (well after Layer 30 is solid) to prevent GAPS
    setTimeout(() => {
      if (slides[currentSlide] === nextActive) {
          lastActive.classList.remove("prev-slide");
      }
    }, 4000);
  }

  function startSlider() {
    if (slideTimer) clearInterval(slideTimer);
    slideTimer = setInterval(() => goToSlide(currentSlide + 1), 7500); 
  }

  // Initialize on load
  initHeroSlider();

  // ---- Walk-Through Slider ----
  const walkTrack = document.getElementById("walkTrack");
  const walkDots = document.querySelectorAll(".walk-dot");
  const walkPrev = document.getElementById("walkPrev");
  const walkNext = document.getElementById("walkNext");
  let walkIndex = 0;
  function goWalk(n) {
    walkDots[walkIndex]?.classList.remove("active");
    walkIndex = (n + walkDots.length) % walkDots.length;
    walkDots[walkIndex]?.classList.add("active");
    if (walkTrack)
      walkTrack.style.transform = `translateX(-${walkIndex * 100}%)`;
  }
  walkDots.forEach((d) =>
    d.addEventListener("click", () => goWalk(+d.dataset.frame)),
  );
  walkPrev?.addEventListener("click", () => goWalk(walkIndex - 1));
  walkNext?.addEventListener("click", () => goWalk(walkIndex + 1));

  // ---- Intersection Observer: Reveal Animations ----
  const revealEls = document.querySelectorAll(".reveal, .reveal-stagger");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { 
      // More lenient threshold and margin for mobile/tablet 
      threshold: 0.05, 
      rootMargin: "0px 0px -20px 0px" 
    },
  );
  revealEls.forEach((el) => observer.observe(el));

  // ---- Counter Animation ----
  const counters = document.querySelectorAll(".stat-number[data-count]");
  const counterObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = +el.dataset.count;
          let start = 0;
          const duration = 1600;
          const step = (timestamp) => {
            if (!start) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            el.textContent = Math.floor(progress * target);
            if (progress < 1) requestAnimationFrame(step);
            else el.textContent = target + (target >= 100 ? "+" : "");
          };
          requestAnimationFrame(step);
          counterObs.unobserve(el);
        }
      });
    },
    { threshold: 0.5 },
  );
  counters.forEach((c) => counterObs.observe(c));

  // ---- Back to Top ----
  const backToTop = document.getElementById("backToTop");
  if (backToTop) {
    window.addEventListener(
      "scroll",
      () => {
        backToTop.classList.toggle("visible", window.scrollY > 500);
      },
      { passive: true },
    );
    backToTop.addEventListener("click", () =>
      window.scrollTo({ top: 0, behavior: "smooth" }),
    );
  }

  // ---- Left Social Bar Scroll Visibility (Landing Page) ----
  const leftSocialBar = document.querySelector(".left-social-bar");
  if (leftSocialBar) {
    window.addEventListener("scroll", () => {
      // Disappear when user scrolls down from the very top
      leftSocialBar.classList.toggle("hidden", window.scrollY > 40);
    }, { passive: true });
  }

  // ---- Active Nav Link ----
  const currentPage = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.remove("active");
    const href = link.getAttribute("href");
    if (href === currentPage || (currentPage === "" && href === "index.html")) {
      link.classList.add("active");
    }
  });

  // ---- Smooth internal link transitions ----
  document.querySelectorAll('a[href$=".html"]').forEach((link) => {
    link.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto") ||
        href.startsWith("tel")
      )
        return;
      e.preventDefault();
      document.body.style.opacity = "0";
      document.body.style.transition = "opacity 0.35s ease";
      setTimeout(() => {
        window.location.href = href;
      }, 350);
    });
  });
  window.addEventListener("pageshow", () => {
    document.body.style.opacity = "1";
  });

  // ---- Contact Form ----
  const contactForm = document.getElementById("contactForm");
  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const btn = contactForm.querySelector('button[type="submit"]');
      const orig = btn.textContent;
      btn.textContent = "Sending…";
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = "Message Sent ✓";
        btn.style.background = "#25a244";
        setTimeout(() => {
          btn.textContent = orig;
          btn.disabled = false;
          btn.style.background = "";
          contactForm.reset();
        }, 3000);
      }, 1400);
    });
  }

  // ---- Touch Swipe for Hero and Walk ----
  function addSwipe(el, onLeft, onRight) {
    let startX = 0;
    el.addEventListener(
      "touchstart",
      (e) => {
        startX = e.touches[0].clientX;
      },
      { passive: true },
    );
    el.addEventListener(
      "touchend",
      (e) => {
        const diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) diff > 0 ? onLeft() : onRight();
      },
      { passive: true },
    );
  }
  const heroEl = document.querySelector(".hero-slides");
  if (heroEl && slides.length) {
    addSwipe(
      heroEl,
      () => {
        clearInterval(slideTimer);
        goToSlide(currentSlide + 1);
        startSlider();
      },
      () => {
        clearInterval(slideTimer);
        goToSlide(currentSlide - 1);
        startSlider();
      },
    );
  }
  if (walkTrack)
    addSwipe(
      walkTrack,
      () => goWalk(walkIndex + 1),
      () => goWalk(walkIndex - 1),
    );
  // ---- Dynamic Page Galleries (Auto-load from folders) ----
  async function initDynamicGalleries() {
    const galleries = document.querySelectorAll("[data-dynamic-gallery]");
    if (!galleries.length) return;

    // Try to fetch latest data from one of our unified API endpoints
    try {
      const res = await fetch("/api/public-gallery");
      const { data } = await res.json();
      if (data) {
        if (!window.PageGalleries) window.PageGalleries = {};
        if (data.artistsCollections) window.PageGalleries.artistsCollections = data.artistsCollections;
        if (data.artworks) window.PageGalleries.artworks = data.artworks;
        // Keep existing window.PageGalleries.hero if it was loaded from page-galleries.js
      }
    } catch (e) {
      console.warn("Could not fetch latest gallery data from API, falling back to static fallback.", e);
    }

    if (!window.PageGalleries) return;

    galleries.forEach((container) => {
      const pageKey = container.getAttribute("data-dynamic-gallery");
      let galleryItems = []; // Array of { src, artist, title }

      if (pageKey === "artworks") {
        if (window.PageGalleries && window.PageGalleries.artistsCollections) {
          const addedTitles = new Set();
          Object.keys(window.PageGalleries.artistsCollections).forEach(key => {
            const artistName = key.split('/')[0];
            const category = key.split('/')[1]?.toLowerCase() || "";
            
            // Only render Keith Zenda and Florah Maphosa
            const allowedArtists = ["KEITH ZENDA", "FLORAH MAPHOSA"];
            if (!allowedArtists.includes(artistName.toUpperCase())) {
              return;
            }
            // Skip commissions category from the main gallery
            if (category === "commissions") {
              return;
            }
            
            const collectionImages = window.PageGalleries.artistsCollections[key].images || [];
            collectionImages.forEach(item => {
              const src = typeof item === 'string' ? item : item.src;
              
              // Exclude whatsapp images from appearing in the main artworks grid
              if (src.toLowerCase().includes('whatsapp')) {
                return;
              }
              
              const fileName = src.split('/').pop();
              const title = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
              
              // Prevent duplicate artworks if they exist in multiple folders
              const cleanTitle = title.trim().toLowerCase();
              if (addedTitles.has(cleanTitle)) {
                return;
              }
              addedTitles.add(cleanTitle);

              galleryItems.push({ 
                src, 
                artist: artistName, 
                title: title,
                medium: item.medium || "Contemporary Work",
                size: item.size || "Inquire for Size",
                year: item.year || "2026",
                description: item.description || "Recently added to our collection."
              });
            });
          });
        }
      } else {
        const images = window.PageGalleries[pageKey] || [];
        galleryItems = images.map(src => ({ src, artist: "ARTGALZIM Artist", title: "Gallery Image" }));
      }

      if (galleryItems.length === 0) {
        if (pageKey === "artworks") {
            container.innerHTML = `<p class="gallery-empty" style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding: 3rem;">No artworks found.<br>Please check back later for updates.</p>`;
        } else {
            container.innerHTML = `<p class="gallery-empty">No images found for ${pageKey}</p>`;
        }
        return;
      }

      // Clear container (except for possible skeleton/loader)
      container.innerHTML = "";

      galleryItems.forEach((itemData) => {
        const item = document.createElement("div");
        const isArtworksPage = pageKey === "artworks";
        const { src, artist, title } = itemData;
        
        if (isArtworksPage) {
          item.className = "artwork-card reveal";
          const cleanTitle = title.charAt(0).toUpperCase() + title.slice(1);
          const medium = itemData.medium || "Contemporary Work";
          const size = itemData.size || "Inquire for Size";
          const year = itemData.year || "2026";
          const desc = itemData.description || "Recently added to our collection.";
          
          item.innerHTML = `
            <div class="artwork-img-area">
              <img src="${src}" alt="${cleanTitle}" loading="lazy">
              <div class="artwork-hover-hint">Expand 🔍</div>
            </div>
            <div class="artwork-meta">
              <p class="artwork-artist">${artist}</p>
              <h3 class="artwork-title">${cleanTitle}</h3>
              <p class="artwork-details">${medium}</p>
              <div class="artwork-card-actions" style="margin-top: 1rem;">
                <button class="btn btn-outline btn-sm view-details-btn">View Details</button>
              </div>
            </div>
          `;
          
          const btn = item.querySelector(".view-details-btn");
          const imgArea = item.querySelector(".artwork-img-area");
          
          const doOpen = () => {
             if (typeof openModal === "function") {
               openModal(src, cleanTitle, artist, medium, size, year, desc, "dynamic", "Quote on Request");
             }
          };
          
          btn.onclick = (e) => { e.stopPropagation(); doOpen(); };
          imgArea.onclick = doOpen;

        } else {
          item.className = "dynamic-gallery-item reveal";
          item.innerHTML = `
            <div class="dynamic-img-wrap">
              <img src="${src}" alt="${title}" loading="lazy">
              <div class="dynamic-img-overlay">
                <span>View</span>
              </div>
            </div>
          `;
          item.addEventListener("click", () => {
            if (typeof openModal === "function") {
              openModal(src, "Gallery Image", "ARTGALZIM Artist", "Contemporary Art", "Various Sizes", "2026", "Added via automated gallery sync.", "dynamic", "Quote on Request");
            } else {
              const viewer = document.createElement("div");
              viewer.className = "simple-lightbox active";
              viewer.innerHTML = `<img src="${src}"><button class="lightbox-close">✕</button>`;
              document.body.appendChild(viewer);
              viewer.querySelector(".lightbox-close").onclick = () => viewer.remove();
            }
          });
        }

        container.appendChild(item);
        if (observer) observer.observe(item);
      });
    });
  }



  // ---- Artist Page Albums (Initialize Covers) ----
  function initArtistAlbums() {
    const cards = document.querySelectorAll('.ap-album-card, .ap-student-card, .ap-artist-submenu a');
    if (!cards.length || !window.PageGalleries || !window.PageGalleries.artistsCollections) return;

    cards.forEach(card => {
      // Find the onclick attribute to get the album title
      const onclick = card.getAttribute('onclick');
      if (!onclick || !onclick.includes('openAlbumViewer')) return;

      const albumTitle = onclick.match(/'([^']+)'/)?.[1];
      if (!albumTitle) return;

      const searchTitle = albumTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchedKey = Object.keys(window.PageGalleries.artistsCollections).find(key => {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedKey === searchTitle || searchTitle.includes(normalizedKey) || normalizedKey.includes(searchTitle);
      });

      if (matchedKey) {
        const data = window.PageGalleries.artistsCollections[matchedKey];
        const cover = data.cover;
        if (cover) {
          // Find the img inside
          const img = card.querySelector('.ap-album-img img, .ap-artist-cover img');
          if (img) {
            img.src = cover;
            img.style.opacity = '1';
          }
        }
      }
    });

    // Special handling for the Emergent Artist covers as well
    const artistCards = document.querySelectorAll('.ap-artist-card');
    artistCards.forEach(card => {
        const h3 = card.querySelector('h3');
        if (!h3) return;
        const name = h3.textContent.trim().toLowerCase();
        
        // Find a representative for the artist if it's a cover
        const matchedKey = Object.keys(window.PageGalleries.artistsCollections).find(key => 
            key.toLowerCase().startsWith(name) && window.PageGalleries.artistsCollections[key].cover
        );

        if (matchedKey) {
            const img = card.querySelector('.ap-artist-cover img');
            if (img && img.src.includes('data:image')) {
                img.src = window.PageGalleries.artistsCollections[matchedKey].cover;
                img.style.opacity = '1';
            }
        }
    });
  }

  // ---- Artist Page Submenu Toggle ----
  window.toggleAPSubmenu = function(artistId) {
    const submenu = document.getElementById(`ap-submenu-${artistId}`);
    const allSubmenus = document.querySelectorAll(".ap-artist-submenu");
    
    // Close other submenus
    allSubmenus.forEach(sub => {
      if (sub.id !== `ap-submenu-${artistId}`) {
        sub.classList.remove("open");
      }
    });

    if (submenu) {
      submenu.classList.toggle("open");
      
      // Optional: Scroll to the artist album if it's not fully visible
      if (submenu.classList.contains("open")) {
        setTimeout(() => {
          submenu.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }, 300);
      }
    }
  };

  // Initialize all galleries on load
  window.addEventListener("load", () => {
    initDynamicGalleries();
    initArtistAlbums();
  });
  window.openAlbumViewer = function(albumTitle) {
    const modal = document.getElementById('albumModal');
    const title = document.getElementById('albumModalTitle');
    const grid = document.getElementById('albumModalGrid');
    
    if (!modal || !title || !grid) return;
    
    // Set the Title
    title.textContent = albumTitle;
    
    // 1. Try to find matched images in our dynamic ARTISTS directory
    let albumData = null;
    if (window.PageGalleries && window.PageGalleries.artistsCollections) {
      // Create a search-friendly version of the requested title
      const searchTitle = albumTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Look for a key that matches (e.g. "WILLARD MAGIGA/Abstracts" vs "Willard Magiga - Abstracts")
      const matchedKey = Object.keys(window.PageGalleries.artistsCollections).find(key => {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedKey === searchTitle || searchTitle.includes(normalizedKey) || normalizedKey.includes(searchTitle);
      });

      if (matchedKey) {
        albumData = window.PageGalleries.artistsCollections[matchedKey];
      }
    }

    let images = albumData ? albumData.images : [];
    
    // Clear old contents
    grid.innerHTML = '';
    
    // If no images in folder, show empty message
    if (!images || images.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted); font-family:var(--font-body);">
        <p style="font-size:1.1rem; margin-bottom:0.5rem;">No artworks yet</p>
        <p style="font-size:0.85rem; opacity:0.6;">Please check back later for updates.</p>
      </div>`;
    } else {
      // Inject the images
      images.forEach(artworkData => {
        const src = typeof artworkData === 'string' ? artworkData : artworkData.src;
        const artDiv = document.createElement('div');
        artDiv.className = 'album-img-wrapper';
        artDiv.innerHTML = `
          <div style="display: flex; flex-direction: column; width: 100%;">
            <img src="${src}" alt="Album Artwork" loading="lazy" style="cursor: pointer; width: 100%; display: block; border-radius: 4px;">
            <div style="margin-top: 12px; text-align: center;">
               <button class="album-view-details-btn" style="
                  background: transparent;
                  color: var(--gold); 
                  border: 1px solid var(--gold); 
                  padding: 10px 0; 
                  width: 100%;
                  border-radius: 4px; 
                  font-family: 'Inter', sans-serif;
                  font-weight: 500; 
                  font-size: 0.8rem; 
                  text-transform: uppercase;
                  letter-spacing: 0.1em;
                  cursor: pointer;
                  transition: all 0.3s ease;
               " onmouseover="this.style.background='var(--gold)'; this.style.color='#000';" onmouseout="this.style.background='transparent'; this.style.color='var(--gold)';">
                  View Details
               </button>
            </div>
          </div>
        `;

        const btn = artDiv.querySelector('.album-view-details-btn');
        if (btn) {
            const lowSrc = src.toLowerCase();
            const artistName = albumTitle.includes('-') ? albumTitle.split('-')[0].trim().toUpperCase() : albumTitle.toUpperCase();
            
            // Detailed works whitelist
            
            const detailedTitles = [
                "blood-stained veil", "chitenge", "red ascendant", "goho", "harvest", 
                "malume", "sekuru", "sunset", "musha", "mukadzi", "nyika",
                "tariro", "hope", "chidochashe", "yevedzai",
                "spiritual guardian", "heritage unwrapped", "heron", "heroin"
            ];
            
            const filename = src.split('/').pop().toLowerCase();
            const isDetailed = detailedTitles.some(dt => filename.includes(dt));
            const isAnonymous = lowSrc.includes('whatsapp') || lowSrc.includes('unnamed') || /^\d+$/.test(src.split('/').pop().split('.')[0]);
            if (isAnonymous || !isDetailed) {
              btn.textContent = 'Inquire to Purchase';
            } else if (lowSrc.includes('cover')) {
              // Usually covers are for navigation
            }

            btn.addEventListener("click", (e) => {
               e.stopPropagation();
                const artist = albumTitle.includes('-') ? albumTitle.split('-')[0].trim() : albumTitle;
                const iMeta = typeof artworkData === 'string' ? { src: artworkData } : artworkData;
                
                let filename = src.split('/').pop().replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                filename = filename.charAt(0).toUpperCase() + filename.slice(1);
                if (isAnonymous || !isDetailed) {
                  // Show Global Inquiry Choice Box
                  showGlobalInquiry(artist, filename);
                } else {
                  // Try to find matching metadata for this piece
                  const lowFilename = filename.toLowerCase();
                  const foundKey = Object.keys(MASTER_ARTWORK_METADATA).find(k => lowFilename.includes(k));
                  const meta = foundKey ? MASTER_ARTWORK_METADATA[foundKey] : {};
                  
                  const finalMed = meta.medium || iMeta.medium || 'Contemporary Work';
                  const finalSize = meta.size || iMeta.size || 'Inquire for Size';
                  const finalYear = meta.year || iMeta.year || '2026';
                  const finalDesc = meta.desc || iMeta.description || 'Recently added to our collection.';

                  // Add metadata to URL for artworks.html to pick up
                  const url = `artworks.html?img=${encodeURIComponent(src)}&artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(filename)}&m=${encodeURIComponent(finalMed)}&s=${encodeURIComponent(finalSize)}&y=${encodeURIComponent(finalYear)}&d=${encodeURIComponent(finalDesc)}`;
                  window.location.href = url;
                }
            });
        }

        const imgEl = artDiv.querySelector("img");
        if (imgEl) {
            const lowSrc = src.toLowerCase();
            const isAnonymousItem = lowSrc.includes('whatsapp') || lowSrc.includes('unnamed') || /^\d+$/.test(src.split('/').pop().split('.')[0]);
            
            if (isAnonymousItem) {
                // Remove pointer cursor so it doesn't look clickable
                imgEl.style.cursor = 'default';
                imgEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Optional: could trigger inquiry here, but usually just doing nothing is better 
                    // since there's an explicit 'Inquire to purchase' button directly below.
                });
            } else {
                imgEl.addEventListener("click", (e) => {
                   e.stopPropagation();
                   const viewer = document.createElement("div");
                   viewer.className = "simple-lightbox";
                   viewer.innerHTML = `<img src="${src}"><button class="lightbox-close">✕</button>`;
                   document.body.appendChild(viewer);
                   
                   requestAnimationFrame(() => {
                     viewer.classList.add("active");
                   });
                   
                   viewer.querySelector(".lightbox-close").onclick = () => {
                     viewer.classList.remove("active");
                     setTimeout(() => viewer.remove(), 300);
                   };
                });
            }
        }
        grid.appendChild(artDiv);
      });
    }
    
    // Open Modal and lock scroll
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  function initArtistCovers() {
    const cards = document.querySelectorAll('.ap-album-card, .ap-artist-card');
    if (!cards.length || !window.PageGalleries || !window.PageGalleries.artistsCollections) return;

    cards.forEach(card => {
      // Find the label text
      const labelEl = card.querySelector('h3');
      if (!labelEl) return;
      const title = labelEl.textContent;
      
      const searchTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const collections = window.PageGalleries.artistsCollections;
      const key = Object.keys(collections).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === searchTitle);
      
      if (key && collections[key].cover) {
        const img = card.querySelector('img');
        if (img) img.src = collections[key].cover;
      }
    });
  }

  // Run initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", async () => {
        await initDynamicGalleries();
        initArtistCovers();
    });
  } else {
    // Top-level async is not supported in all browsers yet, but this is a module-like closure
    (async () => {
      await initDynamicGalleries();
      initArtistCovers();
    })();
  }

  // ---- Admin Dashboard Trigger (Integrated) ----
  function initAdminTrigger() {
    let clicks = 0;
    let timer = null;

    function createAdminModal() {
      const overlay = document.createElement('div');
      overlay.id = 'admin-portal-overlay';
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', zIndex: '20000',
        background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)',
        display: 'none', alignItems: 'center', justifyContent: 'center'
      });

      const close = document.createElement('button');
      close.innerHTML = '✕';
      Object.assign(close.style, {
        position: 'absolute', top: '20px', right: '30px',
        background: 'none', border: 'none', color: '#fff',
        fontSize: '24px', cursor: 'pointer', zIndex: '20001'
      });
      close.onclick = () => { overlay.style.display = 'none'; document.body.style.overflow = ''; };
      overlay.appendChild(close);

      const iframe = document.createElement('iframe');
      iframe.src = 'admin.html';
      Object.assign(iframe.style, {
        width: '95%', height: '90%', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px', background: '#0a0a0a', boxShadow: '0 30px 60px rgba(0,0,0,0.8)'
      });
      overlay.appendChild(iframe);

      document.body.appendChild(overlay);
      return overlay;
    }

    const trigger = document.getElementById('adminSecretTrigger');
    if (trigger) {
      console.log("Admin trigger initialized on footer copyright.");
      trigger.style.cursor = 'pointer'; // Make it obvious for the admin
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        clicks++;
        console.log(`Admin clicks: ${clicks}/5`);
        clearTimeout(timer);
        timer = setTimeout(() => { clicks = 0; }, 3000);
        
        if (clicks >= 5) {
          clicks = 0;
          let overlay = document.getElementById('admin-portal-overlay');
          if (!overlay) overlay = createAdminModal();
          
          overlay.style.display = 'flex';
          document.body.style.overflow = 'hidden';
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminTrigger);
  } else {
    initAdminTrigger();
  }

  // ---- End Admin Logic ----

  // ---- Global Inquiry Logic (Popups) ----
  window.showGlobalInquiry = function(artist, title) {
    const inquiryChoiceBox = document.getElementById('inquiryChoiceBox');
    if (!inquiryChoiceBox) {
      console.error("Inquiry Choice Box not found in DOM");
      return;
    }
    
    inquiryChoiceBox.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const phone = "263776330869";
    const closeBtn = document.getElementById('closeChoiceBox');
    const waBtn = document.getElementById('btnChoiceWA');
    const gmailBtn = document.getElementById('btnChoiceGmail');

    const doClose = () => {
      inquiryChoiceBox.style.display = 'none';
      if (!document.getElementById('artworkModal')?.classList.contains('open') && 
          !document.getElementById('albumModal')?.classList.contains('open')) {
        document.body.style.overflow = '';
      }
    };

    if (closeBtn) closeBtn.onclick = doClose;
    
    if (waBtn) waBtn.onclick = () => {
      const text = encodeURIComponent(`ARTGALZIM PURCHASE INQUIRY\nPiece: ${title}\nArtist: ${artist}\nI would like to acquire this work.`);
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
      doClose();
    };

    if (gmailBtn) gmailBtn.onclick = () => {
      const subject = encodeURIComponent(`Purchase Inquiry: ${title} by ${artist}`);
      const body = encodeURIComponent(`To Artgalzim Center,\n\nI am interested in purchasing the following work:\nPiece: ${title}\nArtist: ${artist}\n\nPlease provide more details and acquisition steps.\n\nThank you.`);
      window.location.href = `mailto:info@artgalzim.com?subject=${subject}&body=${body}`;
      doClose();
    };

    // Click outside to close
    inquiryChoiceBox.onclick = (e) => {
      if (e.target === inquiryChoiceBox) doClose();
    };
  };

  // Close with Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const choiceBox = document.getElementById('inquiryChoiceBox');
      if (choiceBox && choiceBox.style.display === 'flex') {
        choiceBox.style.display = 'none';
        if (!document.getElementById('artworkModal')?.classList.contains('open') && 
            !document.getElementById('albumModal')?.classList.contains('open')) {
          document.body.style.overflow = '';
        }
      }
    }
  });

  window.closeAlbumViewer = function() {
    const modal = document.getElementById('albumModal');
    if (modal) {
      modal.classList.remove('open');
      if (document.getElementById('inquiryChoiceBox')?.style.display !== 'flex') {
        document.body.style.overflow = '';
      }
    }
  };
})()
