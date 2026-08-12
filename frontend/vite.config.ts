import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
      },
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        injectionPoint: undefined
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/unpkg\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "unpkg-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        id: "/",
        scope: "/",
        name: "Plejko",
        short_name: "Plejko",
        description: "Plejko — Pronađi · Okupi · Igraj. Sport, gaming, društvene igre i druženje.",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#050A18",
        theme_color: "#050A18",
        categories: ["sports", "games", "social"],
        icons: [
          { 
            src: "/icons/icon-192.png", 
            sizes: "192x192", 
            type: "image/png",
            purpose: "any"
          },
          { 
            src: "/icons/icon-512.png", 
            sizes: "512x512", 
            type: "image/png",
            purpose: "any"
          },
          { 
            src: "/icons/icon-192.png", 
            sizes: "192x192", 
            type: "image/png",
            purpose: "maskable"
          },
          { 
            src: "/icons/icon-512.png", 
            sizes: "512x512", 
            type: "image/png",
            purpose: "maskable"
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5050",
        changeOrigin: true,
        secure: false,
        ws: true, // Enable websocket proxying
        // Ensure cookies are forwarded properly
        cookieDomainRewrite: "",
        cookiePathRewrite: "/",
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("Proxy error:", err);
          });
        },
      },
    },
  },
});
