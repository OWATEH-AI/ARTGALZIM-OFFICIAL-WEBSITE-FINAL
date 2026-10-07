const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ARTISTS_DIR = path.join(ROOT, 'ARTISTS');
const TIER_FILE = path.join(ROOT, 'js', 'artists-tier.json');

function getTiers() {
  try {
    return JSON.parse(fs.readFileSync(TIER_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function reorganize() {
  console.log('🔄 Reorganizing Emerging Artists into: Abstract, Portraits, Commissions...');
  const tiers = getTiers();
  const emergingFolders = ['Abstract', 'Portraits', 'Commissions'];

  if (!fs.existsSync(ARTISTS_DIR)) return;

  const artists = fs.readdirSync(ARTISTS_DIR);
  for (const artist of artists) {
    const artistPath = path.join(ARTISTS_DIR, artist);
    if (!fs.lstatSync(artistPath).isDirectory()) continue;

    const tier = tiers[artist] || (artist.toUpperCase().includes('KEITH ZENDA') ? 'Keith Zenda' : 'Emerging Artists');

    if (tier === 'Emerging Artists') {
      console.log(`\n🎨 Checking Emerging Artist: ${artist}`);
      
      // 1. If an "Artworks" folder exists, move all files inside to "Abstract"
      const artworksDir = path.join(artistPath, 'Artworks');
      const abstractDir = path.join(artistPath, 'Abstract');
      
      if (!fs.existsSync(abstractDir)) {
        fs.mkdirSync(abstractDir, { recursive: true });
      }

      if (fs.existsSync(artworksDir)) {
        const files = fs.readdirSync(artworksDir);
        for (const file of files) {
          const srcPath = path.join(artworksDir, file);
          const destPath = path.join(abstractDir, file);
          console.log(`  📦 Moving: ${file} -> Abstract/`);
          fs.renameSync(srcPath, destPath);
        }
        // Remove old Artworks folder
        fs.rmdirSync(artworksDir);
        console.log(`  🗑️ Removed deprecated "Artworks" directory for ${artist}`);
      }

      // 2. Ensure all 3 standard folders exist: Abstract, Portraits, Commissions
      for (const folder of emergingFolders) {
        const targetDir = path.join(artistPath, folder);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
          console.log(`  ✨ Created standard folder: /ARTISTS/${artist}/${folder}`);
        }
      }
    }
  }

  console.log('\n✅ All Emerging Artists folders standardized with Abstract, Portraits, Commissions (No "Artworks" folder)!');
}

reorganize();
