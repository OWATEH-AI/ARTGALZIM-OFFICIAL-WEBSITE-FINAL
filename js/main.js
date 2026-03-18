/* =============================================
   ARTGALZIM CENTER — Main JavaScript
   Premium African Art Gallery Website
============================================= */

(function () {
  "use strict";

  // ---- Preloader ----
  window.addEventListener("load", () => {
    setTimeout(() => {
      const pre = document.getElementById("preloader");
      if (pre) pre.classList.add("hidden");
    }, 2200);
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
  const slides = document.querySelectorAll(".hero-slide");
  const heroDots = document.querySelectorAll(".hero-dot");
  let currentSlide = 0,
    slideTimer;
  function goToSlide(n) {
    slides[currentSlide]?.classList.remove("active");
    heroDots[currentSlide]?.classList.remove("active");
    currentSlide = (n + slides.length) % slides.length;
    slides[currentSlide]?.classList.add("active");
    heroDots[currentSlide]?.classList.add("active");
  }
  function startSlider() {
    slideTimer = setInterval(() => goToSlide(currentSlide + 1), 5500);
  }
  heroDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      clearInterval(slideTimer);
      goToSlide(+dot.dataset.slide);
      startSlider();
    });
  });
  if (slides.length) startSlider();

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
    { threshold: 0.12, rootMargin: "0px 0px -60px 0px" },
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
  function initDynamicGalleries() {
    const galleries = document.querySelectorAll("[data-dynamic-gallery]");
    if (!galleries.length || !window.PageGalleries) return;

    galleries.forEach((container) => {
      const pageKey = container.getAttribute("data-dynamic-gallery");
      const images = window.PageGalleries[pageKey] || [];

      if (images.length === 0) {
        container.innerHTML = `<p class="gallery-empty">No images found in images/MAIN IMAGES/${pageKey}/</p>`;
        return;
      }

      // Clear container (except for possible skeleton/loader)
      container.innerHTML = "";

      images.forEach((src) => {
        const item = document.createElement("div");
        const isArtworksPage = pageKey === "artworks";
        
        if (isArtworksPage) {
          item.className = "artwork-card reveal";
          item.innerHTML = `
            <div class="artwork-img-area">
              <img src="${src}" alt="New Artwork" loading="lazy">
              <div class="artwork-hover-hint">Expand 🔍</div>
            </div>
            <div class="artwork-meta">
              <h3 class="artwork-title">New Acquisition</h3>
              <p class="artwork-artist">ARTGALZIM Artist</p>
              <p class="artwork-details">2026 - Contemporary Work</p>
              <div class="artwork-card-actions" style="margin-top: 1rem;">
                <button class="btn btn-outline btn-sm view-details-btn">View Details</button>
              </div>
            </div>
          `;
          
          const btn = item.querySelector(".view-details-btn");
          const imgArea = item.querySelector(".artwork-img-area");
          
          const doOpen = () => {
             if (typeof openModal === "function") {
               openModal(src, "New Acquisition", "ARTGALZIM Artist", "Contemporary Art", "Inquire for Size", "2026", "This piece was recently added to our collection. Please inquire for a full technical breakdown and artist statement.", "dynamic", "Quote on Request");
             }
          };
          
          btn.onclick = (e) => { e.stopPropagation(); doOpen(); };
          imgArea.onclick = doOpen;

        } else {
          item.className = "dynamic-gallery-item reveal";
          item.innerHTML = `
            <div class="dynamic-img-wrap">
              <img src="${src}" alt="Gallery image" loading="lazy">
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

  // Run initialization
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDynamicGalleries);
  } else {
    initDynamicGalleries();
  }
})();
