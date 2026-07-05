import { registerSW } from "virtual:pwa-register";

// Service-worker registration + auto-reload on deploy.
//
// vite-plugin-pwa runs in `autoUpdate` mode: a newly deployed SW calls
// skipWaiting() + clientsClaim(), so it activates and takes control of the
// open page, firing `controllerchange`. We listen for that and reload once so
// the user lands on the new build instead of staying one deploy behind.
//
// Guard: on a brand-new visit the first `controllerchange` is the initial
// claim, not an update — don't reload for that. Only reload when a *new* SW
// replaces an already-controlling one (a real deploy).
const hadController = !!navigator.serviceWorker?.controller;
let reloaded = false;
navigator.serviceWorker?.addEventListener("controllerchange", () => {
  if (!hadController || reloaded) return;
  reloaded = true;
  window.location.reload();
});

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, r) {
    if (!r) return;
    // Pick up deploys on long-open tabs without waiting for the browser's
    // ~24h SW update throttle: check hourly and whenever the tab is refocused.
    setInterval(() => r.update(), 60 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") r.update();
    });
  },
});
