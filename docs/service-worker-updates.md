# Service worker & deploy freshness

The web app (`apps/web`) is an installable PWA served as Cloudflare Worker
static assets. `vite-plugin-pwa` runs in **`injectManifest`** mode with a
hand-written service worker at `apps/web/src/sw.ts` (switched from `generateSW`
so the SW can hold a Web Push `push` handler — see `docs/web-push.md`). This
note describes how a deploy reaches an open/returning user so the behavior isn't
later mistaken for a bug.

Because we hand-write the SW, the three pieces below are now **code in
`src/sw.ts`** rather than plugin config: `skipWaiting()` + `clients.claim()` and
the NetworkFirst HTML-shell route live there directly. Keep them intact when
editing the SW.

## The model

Three pieces work together:

1. **`skipWaiting()` + `clients.claim()`** (`src/sw.ts`). A newly deployed SW
   activates and takes control of the open page immediately instead of waiting
   for every tab to close. (`registerType: "autoUpdate"` stays set in
   `vite.config.ts`; under `injectManifest` the take-control calls are ours.)

2. **Auto-reload on `controllerchange`** (`src/lib/pwa.ts`). We register the SW
   ourselves (`injectRegister: null` disables the plugin's bare
   `registerSW.js`) and listen for `controllerchange`. When a new SW takes
   control we reload the page **once** so the user lands on the new build.
   - Guarded by `hadController`: the first `controllerchange` on a brand-new
     visit is the initial claim, not a deploy — we skip it to avoid a reload
     loop on first visit.
   - Guarded by `reloaded`: fires at most once per page.
   - Also calls `registration.update()` hourly and on tab refocus so
     long-open/idle tabs pick up deploys without waiting for the browser's
     ~24h SW update throttle.

3. **NetworkFirst HTML shell** (`src/sw.ts`, a workbox `registerRoute` for
   `request.mode === "navigate"`). Navigations are served `NetworkFirst` (with a
   short `networkTimeoutSeconds` and offline fallback to the runtime cache)
   rather than cache-first from the
   precached `index.html`. Online users get the fresh shell — and its new
   hashed asset references — on the first load after a deploy instead of one
   deploy behind. Hashed `assets/*` stay precached (content-addressed, always
   safe to serve from cache).

## Why both the reload and NetworkFirst

- NetworkFirst alone still needs the new SW active to switch asset handling.
- The auto-reload alone still shows the old shell for one load before reloading.

Together, an online user gets fresh HTML immediately and, if the SW swapped,
one quick automatic reload settles everything.

## Gotchas

- `src/lib/pwa.ts` is a **side-effect import** in `src/main.tsx`. If that import
  is dropped, the SW never registers and PWA/offline silently breaks.
- Keep the `hadController` + `reloaded` guards if `pwa.ts` is refactored, or you
  risk a reload loop.
- `workbox-window` must stay a direct dependency of `apps/web` — the
  `virtual:pwa-register` module imports it, and Rollup needs to resolve it at
  build time.
