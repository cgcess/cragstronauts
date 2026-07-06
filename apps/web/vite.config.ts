import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // injectManifest: we hand-write the service worker (src/sw.ts) so it can
      // hold a `push` + `notificationclick` handler that the generated SW can't.
      // The NetworkFirst HTML-shell rule and skipWaiting/clientsClaim behaviour
      // documented in docs/service-worker-updates.md now live in src/sw.ts.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // We register the SW ourselves (src/lib/pwa.ts) so we can auto-reload
      // the page when a new build takes control. Stop the plugin injecting
      // its own bare registerSW.js <script>.
      injectRegister: null,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
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
