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
      },
      manifest: {
        id: "/",
        scope: "/",
        name: "Moja Aplikacija",
        short_name: "App",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#111827",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
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
