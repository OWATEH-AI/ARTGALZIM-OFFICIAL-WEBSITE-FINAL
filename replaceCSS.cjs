const fs = require('fs');
let css = fs.readFileSync('css/style.css', 'utf8');

css = css.replace(
  /@media \(max-width: 1100px\) \{\r?\n  :root \{\r?\n    --sidebar-w: 0px;\r?\n  \}\r?\n  \.right-sidebar \{\r?\n    display: none;\r?\n  \}/g,
  `@media (max-width: 1100px) {
  :root {
    --sidebar-w: 0px;
  }
  .nav-links {
    display: none !important;
  }
  .nav-controls {
    margin-left: auto !important;
  }
  .right-sidebar {
    display: none;
  }`
);

css = css.replace(
  /  \.footer-top \{\r?\n    grid-template-columns: 1fr;\r?\n    gap: 2rem;\r?\n  \}\r?\n  \.footer-nav \{\r?\n    display: grid;\r?\n    grid-template-columns: repeat\(3, 1fr\);\r?\n  \}/g,
  `  .footer-top {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
  .footer-nav {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .footer-col {
    border-bottom: 1px solid var(--border);
    padding-bottom: 1.5rem;
  }
  .footer-col-title {
    font-size: 0.9rem;
    letter-spacing: 0.15em;
    margin-bottom: 1.25rem;
  }
  .footer-col a {
    display: block;
    margin-bottom: 0.85rem;
    font-size: 0.95rem;
  }
  .footer-contact {
    font-size: 0.95rem;
    line-height: 2;
  }`
);

css = css.replace(
  /  \.hamburger \{\r?\n    display: flex;\r?\n  \}\r?\n  \.nav-links \{\r?\n    position: fixed;\r?\n    top: 0;\r?\n    right: -100%;\r?\n    bottom: 0;\r?\n    width: min\(320px, 85vw\);\r?\n    background: var\(--bg\);\r?\n    z-index: 997;\r?\n    flex-direction: column;\r?\n    align-items: flex-start;\r?\n    padding: calc\(var\(--nav-h\) \+ 2rem\) 2rem 2rem;\r?\n    gap: 0;\r?\n    border-left: 1px solid var\(--border\);\r?\n    transition: right 0\.4s var\(--ease\);\r?\n    overflow-y: auto;\r?\n  \}\r?\n  \.nav-links\.open \{\r?\n    right: 0;\r?\n  \}\r?\n  \.nav-link \{\r?\n    padding: 1rem 0;\r?\n    width: 100%;\r?\n    border-bottom: 1px solid var\(--border\);\r?\n    font-size: 0\.9rem;\r?\n  \}\r?\n  \.nav-link::after \{\r?\n    display: none;\r?\n  \}\r?\n  \.nav-link-cta \{\r?\n    margin-top: 1\.5rem;\r?\n    border: 1px solid var\(--gold\) !important;\r?\n  \}/g,
  `  .hamburger {
    display: flex;
  }
  .nav-controls {
    margin-left: auto !important;
  }
  .nav-links {
    display: none !important;
  }`
);

css = css.replace(
  /  \.footer-top \{\r?\n    padding: 3rem 1\.5rem 2rem;\r?\n    grid-template-columns: 1fr;\r?\n  \}\r?\n  \.footer-nav \{\r?\n    grid-template-columns: repeat\(2, 1fr\);\r?\n    gap: 1\.5rem;\r?\n  \}/g,
  `  .footer-top {
    padding: 3rem 1.5rem 2rem;
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
  .footer-nav {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .footer-col {
    border-top: 1px solid var(--border);
    padding-top: 1.5rem;
  }
  .footer-col-title {
    font-size: 0.9rem;
    letter-spacing: 0.15em;
    margin-bottom: 1.25rem;
  }
  .footer-col a {
    display: block;
    margin-bottom: 0.85rem;
    font-size: 0.95rem;
  }`
);

fs.writeFileSync('css/style.css', css, 'utf8');
console.log('Done replacement');
