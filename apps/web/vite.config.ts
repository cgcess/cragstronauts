import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // We register the SW ourselves (src/lib/pwa.ts) so we can auto-reload
      // the page when a new build takes control. Stop the plugin injecting
      // its own bare registerSW.js <script>.
      injectRegister: null,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Serve the HTML shell NetworkFirst instead of cache-first from the
        // precached index.html, so an online user gets the fresh shell (and
        // its new hashed asset references) on the first load after a deploy
        // rather than one deploy behind. Falls back to the precached shell
        // when offline / on a slow network.
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-shell",
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Cragstronauts",
        short_name: "Cragstronauts",
        description: "Plan climbing trips with friends",
        theme_color: "#f6f1e8",
        background_color: "#f6f1e8",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        // Forward the WebSocket upgrade for the trip real-time channel.
        ws: true,
      },
    },
  },
});
