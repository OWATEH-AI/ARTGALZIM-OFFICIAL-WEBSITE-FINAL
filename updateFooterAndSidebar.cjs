const fs = require('fs');
const path = require('path');

const dir = __dirname;
const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const standardFooter = `  <footer class="footer" id="footer">
    <div class="footer-top">
      <div class="footer-brand">
        <img src="images/logo.jpg" alt="ARTGALZIM Center" class="footer-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
        <div class="footer-logo-text" style="display: none">ARTGALZIM<br /><small>CENTER</small></div>
        <p class="footer-tagline">Contemporary African Art<br />in the Heart of Domboshava</p>
        <div class="footer-social">
          <a href="https://wa.me/263776330869?text=Hello%20ARTGALZIM%20Center%2C%20I%20discovered%20your%20gallery%20online%20and%20would%20like%20to%20learn%20more%20about%20your%20exhibitions." target="_blank" aria-label="WhatsApp" class="social-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
          <a href="https://www.instagram.com" target="_blank" aria-label="Instagram" class="social-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
          </a>
          <a href="https://www.facebook.com" target="_blank" aria-label="Facebook" class="social-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
          </a>
        </div>
      </div>
      <nav class="footer-nav" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem;">
        <div class="footer-col">
          <h4 class="footer-col-title">Explore</h4>
          <a href="exhibitions.html">Exhibitions</a>
          <a href="artworks.html">Artworks</a>
          <a href="artists.html">Artists</a>
          <a href="services.html">Services</a>
        </div>
        <div class="footer-col">
          <h4 class="footer-col-title">About</h4>
          <a href="about.html">Our Story</a>
          <a href="about.html#mission">Mission &amp; Vision</a>
          <a href="about.html#team">The Team</a>
          <a href="privacy-policy.html">Privacy Policy</a>
        </div>
        <div class="footer-col">
          <h4 class="footer-col-title">Support</h4>
          <a href="donate.html">Donate</a>
          <a href="owa-technologies.html">OWA TECH</a>
        </div>
        <div class="footer-col">
          <h4 class="footer-col-title">Visit</h4>
          <a href="visit.html">Plan Your Visit</a>
          <a href="visit.html#directions">Directions</a>
          <a href="contact.html">Contact</a>
        </div>
      </nav>
      <div class="footer-contact">
        <h4 class="footer-col-title">Get in Touch</h4>
        <p>Mverechena Center, Harare</p>
        <p><a href="tel:+263776330869">+263 77 633 0869</a></p>
        <p><a href="mailto:info@artgalzim.com">info@artgalzim.com</a></p>
      </div>
    </div>
    <div class="footer-bottom" style="border-top: 1px solid var(--border); padding: 0.8rem 0; margin-top: 1.5rem;">
      <div style="max-width: 1400px; margin: 0 auto; padding: 0 2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <p style="font-size: 0.8rem; color: var(--text-muted);">&copy; 2026 ARTGALZIM CENTER</p>
        <div style="font-weight: 700; letter-spacing: 0.15em; color: var(--gold); font-size: 0.72rem; text-transform: uppercase;">
          POWERED BY <a href="owa-technologies.html" style="color: inherit; text-decoration: none; border-bottom: 2px solid var(--gold);">OWA TECHNOLOGIES</a>
        </div>
      </div>
    </div>
  </footer>`;

for (const file of htmlFiles) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1. Footer Replacement
  const footerStart = content.indexOf('<footer class="footer" id="footer">');
  const footerEndToken = '</footer>';
  const footerEnd = content.indexOf(footerEndToken, footerStart);

  if (footerStart !== -1 && footerEnd !== -1) {
    let beforeFooter = content.substring(0, footerStart);
    beforeFooter = beforeFooter.replace(/<!--\s*=====\s*FOOTER\s*=====\s*-->\s*$/, '');
    const afterFooter = content.substring(footerEnd + footerEndToken.length);
    content = beforeFooter + '<!-- ===== FOOTER ===== -->\n' + standardFooter + afterFooter;
  }

  // 2. Sidebar Replacement - Comprehensive
  // This looks for the sidebar nav links section and replaces it entirely for consistency
  const sidebarNavStart = content.indexOf('<div class="sidebar-nav-links">');
  const sidebarNavEndToken = '</div>';
  const sidebarNavEnd = content.indexOf(sidebarNavEndToken, sidebarNavStart);

  if (sidebarNavStart !== -1 && sidebarNavEnd !== -1) {
    const activeFile = file;
    const getLinkClass = (target) => activeFile === target ? 'sidebar-nav-link active' : 'sidebar-nav-link';
    
    const newSidebarNav = `<div class="sidebar-nav-links">
          <a href="index.html" class="${getLinkClass('index.html')}">Home</a>
          <a href="exhibitions.html" class="${getLinkClass('exhibitions.html')}">Exhibitions</a>
          <a href="artists.html" class="${getLinkClass('artists.html')}">Artists</a>
          <a href="artworks.html" class="${getLinkClass('artworks.html')}">Artworks</a>
          <a href="about.html" class="${getLinkClass('about.html')}">About Us</a>
          <a href="services.html" class="${getLinkClass('services.html')}">Services</a>
          <a href="visit.html" class="${getLinkClass('visit.html')}">Plan Your Visit</a>
          <a href="contact.html" class="${getLinkClass('contact.html')}">Contact</a>
          <a href="donate.html" class="${getLinkClass('donate.html')}">Donate & Support</a>
          <a href="owa-technologies.html" class="${getLinkClass('owa-technologies.html')}">OWA TECHNOLOGIES</a>
        </div>`;
    
    content = content.substring(0, sidebarNavStart) + newSidebarNav + content.substring(sidebarNavEnd + sidebarNavEndToken.length);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log('Updated ' + file);
}
