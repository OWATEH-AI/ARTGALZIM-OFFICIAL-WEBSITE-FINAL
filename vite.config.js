import { defineConfig } from 'vite';
import { exec } from 'child_process';

const watchGalleryPlugin = () => {
  return {
    name: 'watch-gallery',
    configureServer(server) {
      server.watcher.on('all', (event, filePath) => {
        if (event === 'add' || event === 'unlink' || event === 'change') {
          if (filePath.includes('ARTISTS') || filePath.includes('MAIN IMAGES')) {
            exec('node sync-gallery.cjs', (err, stdout) => {
              if (err) console.error('Gallery sync failed:', err);
              else console.log(stdout);
            });
          }
        }
      });
    }
  };
};

export default defineConfig({
  plugins: [watchGalleryPlugin()],
  server: {
    port: 5299,
    strictPort: true,    // always use 5299 — dedicated ARTGALZIM port
    host: true,          // expose on local network
    open: true,
    hmr: {
      overlay: true      // show errors as overlay instead of crashing
    },
    headers: {
      'Accept-Ranges': 'bytes'  // Enable range requests so video can seek/stream properly
    }
  },
  assetsInclude: ['**/*.mp4', '**/*.webm', '**/*.ogg'],  // Include video files as static assets
  build: {
    assetsInlineLimit: 0, // Never inline videos as base64
    rollupOptions: {
      input: {
        main: './index.html',
        about: './about.html',
        admin: './admin.html',
        artists: './artists.html',
        artworks: './artworks.html',
        contact: './contact.html',
        donate: './donate.html',
        exhibitions: './exhibitions.html',
        owa: './owa-technologies.html',
        privacy: './privacy-policy.html',
        services: './services.html',
        visit: './visit.html'
      }
    }
  }
});
