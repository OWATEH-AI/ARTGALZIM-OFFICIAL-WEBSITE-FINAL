const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'index.html');
let content = fs.readFileSync(file, 'utf-8');

const replacement = `    <div class="left-social-bar">
      <a href="https://www.facebook.com" target="_blank" class="left-social-link" aria-label="Facebook">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
      </a>
      <a href="https://www.instagram.com" target="_blank" class="left-social-link" aria-label="Instagram">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
      </a>
      <div class="left-social-divider"></div>
      <span class="left-social-label">Follow Us</span>
    </div>

    <!-- ===== RIGHT SIDEBAR DRAWER ===== -->
    <aside class="sidebar-drawer" id="rightSidebar">
      <div class="sidebar-drawer-header">
        <div class="sidebar-drawer-logo">ARTGALZIM <span>Center</span></div>
        <button class="sidebar-close-btn" id="sidebarCloseBtn" aria-label="Close menu">✕</button>
      </div>
      <div class="sidebar-drawer-body">
        <div class="sidebar-nav-section">
          <h4>Explore & Services</h4>
          <div class="sidebar-nav-links">
            <a href="index.html" class="sidebar-nav-link active">Home</a>
            <a href="exhibitions.html" class="sidebar-nav-link">Exhibitions</a>
            <a href="artists.html" class="sidebar-nav-link">Artists</a>
            <a href="artworks.html" class="sidebar-nav-link">Artworks</a>
            <a href="about.html" class="sidebar-nav-link">About Us</a>
            <a href="services.html" class="sidebar-nav-link">Services</a>
            <a href="visit.html" class="sidebar-nav-link">Plan Your Visit</a>
            <a href="contact.html" class="sidebar-nav-link">Contact</a>
            <a href="donate.html" class="sidebar-nav-link">Donate & Support</a>
          </div>
        </div>
        <div class="sidebar-info-section">
          <h4>Location</h4>
          <p>Mverechena Business Center<br/>Domboshava, Zimbabwe</p>
        </div>
        <div class="sidebar-info-section">
          <h4>Call or Email</h4>
          <p><a href="tel:+263776330869">+263 77 633 0869</a></p>
          <p><a href="mailto:info@artgalzim.com">info@artgalzim.com</a></p>
        </div>
      </div>
    </aside>`;

// We find the index of "<!-- ===== RIGHT SIDEBAR ===== -->"
// and the index of "<!-- ===== MOBILE MENU OVERLAY ===== -->"
const startIdx = content.indexOf('<!-- ===== RIGHT SIDEBAR ===== -->');
const endIdx = content.indexOf('<!-- ===== MOBILE MENU OVERLAY ===== -->');

if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + replacement + '\n\n    ' + content.substring(endIdx);
    fs.writeFileSync(file, content);
    console.log("Replaced old sidebar successfully!");
} else {
    console.log("Could not find start or end markers");
}
