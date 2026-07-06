/// <reference lib="webworker" />
//
// Hand-written service worker (vite-plugin-pwa `injectManifest`). generateSW
// can't hold a custom `push` listener, so we own the SW to add Web Push while
// preserving the precache + deploy-freshness behaviour documented in
// docs/service-worker-updates.md.
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare let self: ServiceWorkerGlobalScope;

// Precache everything the build injects here.
precacheAndRoute(self.__WB_MANIFEST);

// Take control of open pages as soon as this SW activates (paired with the
// controllerchange reload in src/lib/pwa.ts).
self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// NetworkFirst HTML shell (ported from the old workbox.runtimeCaching rule).
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "html-shell",
    networkTimeoutSeconds: 3,
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  }),
);

// Web Push: render the notification the API sent (see apps/api/src/push.ts).
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }
  const title = payload.title ?? "Cragstronauts";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url ?? "/" },
    }),
  );
});

// Tapping a notification: focus an existing tab or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && new URL(client.url).pathname !== url) {
            await client.navigate(url).catch(() => {});
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
