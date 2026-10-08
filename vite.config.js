import { defineConfig } from 'vite';
import { exec, spawn } from 'child_process';
import http from 'http';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const adminServerPlugin = () => {
  let adminProc = null;
  return {
    name: 'admin-server-manager',
    configureServer() {
      const checkReq = http.get('http://localhost:3747/api/artists', (res) => {
        // admin server is already alive
      });
      checkReq.on('error', () => {
        console.log('🚀 Spawning ARTGALZIM Admin Server on port 3747...');
        adminProc = spawn('node', ['admin-server.cjs'], {
          cwd: process.cwd(),
          stdio: 'inherit',
          shell: true
        });
      });
    }
  };
};

const watchGalleryPlugin = () => {
  return {
    name: 'watch-gallery',
    configureServer(server) {
      server.watcher.on('all', (event, filePath) => {
        if (event === 'add' || event === 'unlink' || event === 'change') {
          if (filePath.includes('ARTISTS') || filePath.includes('MAIN IMAGES') || filePath.includes('artworks-metadata') || filePath.includes('exhibitions-data')) {
            exec('node sync-gallery.cjs', (err, stdout) => {
              if (err) console.error('Real-time sync failed:', err);
              else console.log('⚡ Local gallery index refreshed');
            });
          }
        }
      });
    }
  };
};

export default defineConfig({
  plugins: [
    adminServerPlugin(),
    watchGalleryPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: 'ARTISTS/**/*',
          dest: 'ARTISTS',
          allowEmpty: true
        },
        {
          src: 'images/**/*',
          dest: 'images',
          allowEmpty: true
        },
        {
          src: 'HERO ANIMATION/**/*',
          dest: 'HERO ANIMATION',
          allowEmpty: true
        },
        {
          src: 'Background images/**/*',
          dest: 'Background images',
          allowEmpty: true
        },
        {
          src: 'Customisations/**/*',
          dest: 'Customisations',
          allowEmpty: true
        },
        {
          src: 'js/artworks-metadata.json',
          dest: 'js',
          allowEmpty: true
        },
        {
          src: 'robots.txt',
          dest: '.',
          allowEmpty: true
        },
        {
          src: 'sitemap.xml',
          dest: '.',
          allowEmpty: true
        }
      ]
    })
  ],
  server: {
    port: 5299,
    strictPort: true,    // always use 5299 — dedicated ARTGALZIM port
    host: true,          // expose on local network
    open: true,
    watch: {
      ignored: [
        '**/ARTISTS/**',
        '**/images/**',
        '**/HERO ANIMATION/**',
        '**/Background images/**',
        '**/Customisations/**',
        '**/js/*.json',
        '**/tmp_uploads/**',
        '**/large_files.json',
        '**/build-error.txt',
        '**/sitemap.xml',
        '**/robots.txt',
        '**/.git/**'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3747',
        changeOrigin: true,
        secure: false
      }
    },
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
        journal: './journal.html',
        scholarships: './scholarships.html',
        owa: './owa-technologies.html',
        privacy: './privacy-policy.html',
        services: './services.html',
        ctep: './ctep.html',
        visit: './visit.html'
      }
    }
  }
});
