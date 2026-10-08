import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MediaStorageService } from './neon-backend-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

async function indexAllMedia() {
  console.log('📦 Cataloging all media assets into Neon Media Registry...');
  let totalIndexed = 0;

  // 1. Index Videos -> 'uploads' & 'media' bucket
  const videoDirs = [path.join(ROOT, 'ART VIDEO'), path.join(ROOT, 'videos')];
  for (const vDir of videoDirs) {
    if (fs.existsSync(vDir)) {
      const files = fs.readdirSync(vDir);
      for (const file of files) {
        if (['.mp4', '.webm', '.ogg'].includes(path.extname(file).toLowerCase())) {
          const stats = fs.statSync(path.join(vDir, file));
          const relPath = path.relative(ROOT, path.join(vDir, file)).replace(/\\/g, '/');
          await MediaStorageService.registerAsset({
            bucketName: 'uploads',
            fileKey: `videos/${file}`,
            fileUrl: `/${relPath}`,
            fileType: 'video',
            mimeType: 'video/mp4',
            fileSizeBytes: stats.size,
            title: file.replace(/\.[^/.]+$/, ''),
            description: 'Gallery promo & exhibition video advert',
            tags: ['video', 'advert', 'promo', 'exhibition']
          });
          totalIndexed++;
        }
      }
    }
  }

  // 2. Index Hero Animation & Backgrounds -> 'assets' bucket
  const assetDirs = [path.join(ROOT, 'HERO ANIMATION'), path.join(ROOT, 'Background images')];
  for (const aDir of assetDirs) {
    if (fs.existsSync(aDir)) {
      const files = fs.readdirSync(aDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
          const stats = fs.statSync(path.join(aDir, file));
          const relPath = path.relative(ROOT, path.join(aDir, file)).replace(/\\/g, '/');
          await MediaStorageService.registerAsset({
            bucketName: 'assets',
            fileKey: `graphics/${file}`,
            fileUrl: `/${relPath}`,
            fileType: 'image',
            mimeType: ext === '.png' ? 'image/png' : 'image/jpeg',
            fileSizeBytes: stats.size,
            title: file.replace(/\.[^/.]+$/, ''),
            description: 'UI Hero & Background Branding Asset',
            tags: ['branding', 'hero', 'ui', 'graphic']
          });
          totalIndexed++;
        }
      }
    }
  }

  // 3. Index Artist Artworks -> 'media' bucket
  const artistsDir = path.join(ROOT, 'ARTISTS');
  if (fs.existsSync(artistsDir)) {
    const artists = fs.readdirSync(artistsDir);
    for (const artist of artists) {
      const artistPath = path.join(artistsDir, artist);
      if (fs.lstatSync(artistPath).isDirectory()) {
        const categories = fs.readdirSync(artistPath);
        for (const cat of categories) {
          const catPath = path.join(artistPath, cat);
          if (fs.lstatSync(catPath).isDirectory()) {
            const files = fs.readdirSync(catPath);
            for (const file of files) {
              const ext = path.extname(file).toLowerCase();
              if (['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
                const stats = fs.statSync(path.join(catPath, file));
                const relPath = path.relative(ROOT, path.join(catPath, file)).replace(/\\/g, '/');
                await MediaStorageService.registerAsset({
                  bucketName: 'media',
                  fileKey: `artworks/${artist}/${cat}/${file}`,
                  fileUrl: `/${relPath}`,
                  fileType: 'image',
                  mimeType: ext === '.png' ? 'image/png' : 'image/jpeg',
                  fileSizeBytes: stats.size,
                  title: file.replace(/\.[^/.]+$/, ''),
                  description: `Artwork by ${artist} (${cat})`,
                  tags: ['artwork', artist, cat]
                });
                totalIndexed++;
              }
            }
          }
        }
      }
    }
  }

  console.log(`✨ Total of ${totalIndexed} media assets indexed into Neon Storage Registry!`);
}

indexAllMedia();
