import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        id: "/",
        scope: "/",
        name: "PlayMatch Global",
        short_name: "PlayMatch",
        description: "Pronađi igrače i terene za fudbal u tvom gradu",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#2e7d32",
        categories: ["sports", "social"],
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
