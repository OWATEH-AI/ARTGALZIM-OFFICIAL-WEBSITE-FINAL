// vite.config.js
import { defineConfig } from "file:///C:/Users/LYKART06/Downloads/MY%20WEBSITES%20PROJ/ARTGALZIM%20WEB/node_modules/vite/dist/node/index.js";
import { exec } from "child_process";
import { viteStaticCopy } from "file:///C:/Users/LYKART06/Downloads/MY%20WEBSITES%20PROJ/ARTGALZIM%20WEB/node_modules/vite-plugin-static-copy/dist/index.js";
var watchGalleryPlugin = () => {
  return {
    name: "watch-gallery",
    configureServer(server) {
      server.watcher.on("all", (event, filePath) => {
        if (event === "add" || event === "unlink" || event === "change") {
          if (filePath.includes("ARTISTS") || filePath.includes("MAIN IMAGES")) {
            exec("node sync-gallery.cjs", (err, stdout) => {
              if (err) console.error("Gallery sync failed:", err);
              else console.log(stdout);
            });
          }
        }
      });
    }
  };
};
var vite_config_default = defineConfig({
  plugins: [
    watchGalleryPlugin(),
    viteStaticCopy({
      targets: [
        {
          src: "ARTISTS/**/*",
          dest: "ARTISTS",
          allowEmpty: true
        },
        {
          src: "images/**/*",
          dest: "images",
          allowEmpty: true
        },
        {
          src: "HERO ANIMATION/**/*",
          dest: "HERO ANIMATION",
          allowEmpty: true
        },
        {
          src: "Background images/**/*",
          dest: "Background images",
          allowEmpty: true
        },
        {
          src: "Customisations/**/*",
          dest: "Customisations",
          allowEmpty: true
        }
      ]
    })
  ],
  server: {
    port: 5299,
    strictPort: true,
    // always use 5299 — dedicated ARTGALZIM port
    host: true,
    // expose on local network
    open: true,
    hmr: {
      overlay: true
      // show errors as overlay instead of crashing
    },
    headers: {
      "Accept-Ranges": "bytes"
      // Enable range requests so video can seek/stream properly
    }
  },
  assetsInclude: ["**/*.mp4", "**/*.webm", "**/*.ogg"],
  // Include video files as static assets
  build: {
    assetsInlineLimit: 0,
    // Never inline videos as base64
    rollupOptions: {
      input: {
        main: "./index.html",
        about: "./about.html",
        admin: "./admin.html",
        artists: "./artists.html",
        artworks: "./artworks.html",
        contact: "./contact.html",
        donate: "./donate.html",
        exhibitions: "./exhibitions.html",
        owa: "./owa-technologies.html",
        privacy: "./privacy-policy.html",
        services: "./services.html",
        visit: "./visit.html"
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxMWUtBUlQwNlxcXFxEb3dubG9hZHNcXFxcTVkgV0VCU0lURVMgUFJPSlxcXFxBUlRHQUxaSU0gV0VCXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxMWUtBUlQwNlxcXFxEb3dubG9hZHNcXFxcTVkgV0VCU0lURVMgUFJPSlxcXFxBUlRHQUxaSU0gV0VCXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9MWUtBUlQwNi9Eb3dubG9hZHMvTVklMjBXRUJTSVRFUyUyMFBST0ovQVJUR0FMWklNJTIwV0VCL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XG5pbXBvcnQgeyB2aXRlU3RhdGljQ29weSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXN0YXRpYy1jb3B5JztcblxuY29uc3Qgd2F0Y2hHYWxsZXJ5UGx1Z2luID0gKCkgPT4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICd3YXRjaC1nYWxsZXJ5JyxcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICBzZXJ2ZXIud2F0Y2hlci5vbignYWxsJywgKGV2ZW50LCBmaWxlUGF0aCkgPT4ge1xuICAgICAgICBpZiAoZXZlbnQgPT09ICdhZGQnIHx8IGV2ZW50ID09PSAndW5saW5rJyB8fCBldmVudCA9PT0gJ2NoYW5nZScpIHtcbiAgICAgICAgICBpZiAoZmlsZVBhdGguaW5jbHVkZXMoJ0FSVElTVFMnKSB8fCBmaWxlUGF0aC5pbmNsdWRlcygnTUFJTiBJTUFHRVMnKSkge1xuICAgICAgICAgICAgZXhlYygnbm9kZSBzeW5jLWdhbGxlcnkuY2pzJywgKGVyciwgc3Rkb3V0KSA9PiB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIGNvbnNvbGUuZXJyb3IoJ0dhbGxlcnkgc3luYyBmYWlsZWQ6JywgZXJyKTtcbiAgICAgICAgICAgICAgZWxzZSBjb25zb2xlLmxvZyhzdGRvdXQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH07XG59O1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgd2F0Y2hHYWxsZXJ5UGx1Z2luKCksXG4gICAgdml0ZVN0YXRpY0NvcHkoe1xuICAgICAgdGFyZ2V0czogW1xuICAgICAgICB7XG4gICAgICAgICAgc3JjOiAnQVJUSVNUUy8qKi8qJyxcbiAgICAgICAgICBkZXN0OiAnQVJUSVNUUycsXG4gICAgICAgICAgYWxsb3dFbXB0eTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiAnaW1hZ2VzLyoqLyonLFxuICAgICAgICAgIGRlc3Q6ICdpbWFnZXMnLFxuICAgICAgICAgIGFsbG93RW1wdHk6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHNyYzogJ0hFUk8gQU5JTUFUSU9OLyoqLyonLFxuICAgICAgICAgIGRlc3Q6ICdIRVJPIEFOSU1BVElPTicsXG4gICAgICAgICAgYWxsb3dFbXB0eTogdHJ1ZVxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgc3JjOiAnQmFja2dyb3VuZCBpbWFnZXMvKiovKicsXG4gICAgICAgICAgZGVzdDogJ0JhY2tncm91bmQgaW1hZ2VzJyxcbiAgICAgICAgICBhbGxvd0VtcHR5OiB0cnVlXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBzcmM6ICdDdXN0b21pc2F0aW9ucy8qKi8qJyxcbiAgICAgICAgICBkZXN0OiAnQ3VzdG9taXNhdGlvbnMnLFxuICAgICAgICAgIGFsbG93RW1wdHk6IHRydWVcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pXG4gIF0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQ6IDUyOTksXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSwgICAgLy8gYWx3YXlzIHVzZSA1Mjk5IFx1MjAxNCBkZWRpY2F0ZWQgQVJUR0FMWklNIHBvcnRcbiAgICBob3N0OiB0cnVlLCAgICAgICAgICAvLyBleHBvc2Ugb24gbG9jYWwgbmV0d29ya1xuICAgIG9wZW46IHRydWUsXG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiB0cnVlICAgICAgLy8gc2hvdyBlcnJvcnMgYXMgb3ZlcmxheSBpbnN0ZWFkIG9mIGNyYXNoaW5nXG4gICAgfSxcbiAgICBoZWFkZXJzOiB7XG4gICAgICAnQWNjZXB0LVJhbmdlcyc6ICdieXRlcycgIC8vIEVuYWJsZSByYW5nZSByZXF1ZXN0cyBzbyB2aWRlbyBjYW4gc2Vlay9zdHJlYW0gcHJvcGVybHlcbiAgICB9XG4gIH0sXG4gIGFzc2V0c0luY2x1ZGU6IFsnKiovKi5tcDQnLCAnKiovKi53ZWJtJywgJyoqLyoub2dnJ10sICAvLyBJbmNsdWRlIHZpZGVvIGZpbGVzIGFzIHN0YXRpYyBhc3NldHNcbiAgYnVpbGQ6IHtcbiAgICBhc3NldHNJbmxpbmVMaW1pdDogMCwgLy8gTmV2ZXIgaW5saW5lIHZpZGVvcyBhcyBiYXNlNjRcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBpbnB1dDoge1xuICAgICAgICBtYWluOiAnLi9pbmRleC5odG1sJyxcbiAgICAgICAgYWJvdXQ6ICcuL2Fib3V0Lmh0bWwnLFxuICAgICAgICBhZG1pbjogJy4vYWRtaW4uaHRtbCcsXG4gICAgICAgIGFydGlzdHM6ICcuL2FydGlzdHMuaHRtbCcsXG4gICAgICAgIGFydHdvcmtzOiAnLi9hcnR3b3Jrcy5odG1sJyxcbiAgICAgICAgY29udGFjdDogJy4vY29udGFjdC5odG1sJyxcbiAgICAgICAgZG9uYXRlOiAnLi9kb25hdGUuaHRtbCcsXG4gICAgICAgIGV4aGliaXRpb25zOiAnLi9leGhpYml0aW9ucy5odG1sJyxcbiAgICAgICAgb3dhOiAnLi9vd2EtdGVjaG5vbG9naWVzLmh0bWwnLFxuICAgICAgICBwcml2YWN5OiAnLi9wcml2YWN5LXBvbGljeS5odG1sJyxcbiAgICAgICAgc2VydmljZXM6ICcuL3NlcnZpY2VzLmh0bWwnLFxuICAgICAgICB2aXNpdDogJy4vdmlzaXQuaHRtbCdcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtYLFNBQVMsb0JBQW9CO0FBQy9ZLFNBQVMsWUFBWTtBQUNyQixTQUFTLHNCQUFzQjtBQUUvQixJQUFNLHFCQUFxQixNQUFNO0FBQy9CLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLGdCQUFnQixRQUFRO0FBQ3RCLGFBQU8sUUFBUSxHQUFHLE9BQU8sQ0FBQyxPQUFPLGFBQWE7QUFDNUMsWUFBSSxVQUFVLFNBQVMsVUFBVSxZQUFZLFVBQVUsVUFBVTtBQUMvRCxjQUFJLFNBQVMsU0FBUyxTQUFTLEtBQUssU0FBUyxTQUFTLGFBQWEsR0FBRztBQUNwRSxpQkFBSyx5QkFBeUIsQ0FBQyxLQUFLLFdBQVc7QUFDN0Msa0JBQUksSUFBSyxTQUFRLE1BQU0sd0JBQXdCLEdBQUc7QUFBQSxrQkFDN0MsU0FBUSxJQUFJLE1BQU07QUFBQSxZQUN6QixDQUFDO0FBQUEsVUFDSDtBQUFBLFFBQ0Y7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsbUJBQW1CO0FBQUEsSUFDbkIsZUFBZTtBQUFBLE1BQ2IsU0FBUztBQUFBLFFBQ1A7QUFBQSxVQUNFLEtBQUs7QUFBQSxVQUNMLE1BQU07QUFBQSxVQUNOLFlBQVk7QUFBQSxRQUNkO0FBQUEsUUFDQTtBQUFBLFVBQ0UsS0FBSztBQUFBLFVBQ0wsTUFBTTtBQUFBLFVBQ04sWUFBWTtBQUFBLFFBQ2Q7QUFBQSxRQUNBO0FBQUEsVUFDRSxLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsVUFDTixZQUFZO0FBQUEsUUFDZDtBQUFBLFFBQ0E7QUFBQSxVQUNFLEtBQUs7QUFBQSxVQUNMLE1BQU07QUFBQSxVQUNOLFlBQVk7QUFBQSxRQUNkO0FBQUEsUUFDQTtBQUFBLFVBQ0UsS0FBSztBQUFBLFVBQ0wsTUFBTTtBQUFBLFVBQ04sWUFBWTtBQUFBLFFBQ2Q7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBO0FBQUEsSUFDWixNQUFNO0FBQUE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQTtBQUFBLElBQ1g7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLGlCQUFpQjtBQUFBO0FBQUEsSUFDbkI7QUFBQSxFQUNGO0FBQUEsRUFDQSxlQUFlLENBQUMsWUFBWSxhQUFhLFVBQVU7QUFBQTtBQUFBLEVBQ25ELE9BQU87QUFBQSxJQUNMLG1CQUFtQjtBQUFBO0FBQUEsSUFDbkIsZUFBZTtBQUFBLE1BQ2IsT0FBTztBQUFBLFFBQ0wsTUFBTTtBQUFBLFFBQ04sT0FBTztBQUFBLFFBQ1AsT0FBTztBQUFBLFFBQ1AsU0FBUztBQUFBLFFBQ1QsVUFBVTtBQUFBLFFBQ1YsU0FBUztBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsYUFBYTtBQUFBLFFBQ2IsS0FBSztBQUFBLFFBQ0wsU0FBUztBQUFBLFFBQ1QsVUFBVTtBQUFBLFFBQ1YsT0FBTztBQUFBLE1BQ1Q7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
