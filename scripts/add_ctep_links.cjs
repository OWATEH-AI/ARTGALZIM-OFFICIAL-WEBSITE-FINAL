const fs = require('fs');
const path = require('path');

const files = [
  'about.html',
  'artists.html',
  'artworks.html',
  'contact.html',
  'donate.html',
  'exhibitions.html',
  'owa-technologies.html',
  'privacy-policy.html',
  'visit.html'
];

files.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Sidebar replacement
  const sidebarTarget = '<a href="services.html" class="sidebar-nav-link">Services</a>';
  const sidebarTargetActive = '<a href="services.html" class="sidebar-nav-link active">Services</a>';
  const ctepSidebar = '<a href="https://www.ctep.artgalzim.com" class="sidebar-nav-link" target="_blank" rel="noopener noreferrer">CTEP</a>';

  if (content.includes(sidebarTarget) && !content.includes(ctepSidebar)) {
    content = content.replace(sidebarTarget, sidebarTarget + '\n          ' + ctepSidebar);
  } else if (content.includes(sidebarTargetActive) && !content.includes(ctepSidebar)) {
    content = content.replace(sidebarTargetActive, sidebarTargetActive + '\n          ' + ctepSidebar);
  }

  // Footer replacement
  const footerTarget = '<a href="services.html">Services</a>';
  const ctepFooter = '<a href="https://www.ctep.artgalzim.com" target="_blank" rel="noopener noreferrer">CTEP</a>';

  if (content.includes(footerTarget) && !content.includes(ctepFooter)) {
    content = content.replace(footerTarget, footerTarget + '\n          ' + ctepFooter);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated CTEP in ' + file);
});
