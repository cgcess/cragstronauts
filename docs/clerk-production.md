# Clerk in production

How auth is wired (so the steps below make sense):

- **Backend** (Worker) reads `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` from
  env at request time. Both must be set or the Worker skips Clerk and serves the
  public cooperative board. Secrets can be added/changed anytime without a
  rebuild.
- **Frontend** bakes `VITE_CLERK_PUBLISHABLE_KEY` in at **build** time. It must
  be present when `vite build` runs; changing it requires a rebuild + redeploy.
- Auth is additive: deploy with no keys and the app behaves exactly as it does
  today (no sign-in), then "turn on" auth by adding the keys.

## Decide first: custom domain or workers.dev?

- **Custom domain** enables a real Clerk **production** instance
  (recommended for launch). Needs DNS access on the domain.
- **workers.dev only** means staying on the Clerk **development** instance even
  when deployed (Path B). Works, but has dev rate limits, a "development"
  banner, and shared Google credentials. Fine as an interim.

---

## Path A: proper production (custom domain)

**Owner: Nico (Clerk dashboard).**

1. Create a **production** instance for the Cragstronauts app.
2. Clerk shows a set of **DNS records** (e.g. `clerk.`, `accounts.`,
   `clkmail.`, DKIM). Add them on the domain. _(Whoever controls the domain's
   DNS does this.)_
3. Production does **not** use Clerk's shared Google credentials, so add the
   project's own Google OAuth client:
   - In the Clerk dashboard, open the Google social connection and copy the
     **Authorized redirect URI** it shows (looks like
     `https://clerk.<domain>/v1/oauth_callback`).
   - In the Google Cloud console, open the OAuth client Nico created earlier and
     set that as an Authorized redirect URI. Copy the client ID + secret.
   - Paste the client ID + secret back into Clerk and enable the connection.
4. From **API keys**, copy the production `pk_live_…` and `sk_live_…`.

## Path B: interim on workers.dev

**Owner: Nico.**

- Skip the DNS and own-Google steps. Reuse the current **dev** keys
  (`pk_test_…` / `sk_test_…`); Google works via Clerk's shared credentials.
- Move to Path A once a domain exists.

---

## Cloudflare / deploy

**Owner: Colin.**

> Needs the workers.dev subdomain (or the custom domain) and a Cloudflare login.
> Run from the repo root with Node 22.

1. `wrangler login`
2. Set the backend keys on the Worker (paste `*_live` for Path A, `*_test` for
   Path B). Both are required:
   ```bash
   wrangler secret put CLERK_SECRET_KEY
   wrangler secret put CLERK_PUBLISHABLE_KEY
   ```
   (Publishable can alternatively be a `vars` entry in `apps/api/wrangler.jsonc`,
   since it is safe to expose. Secret put is simplest.)
3. Provide the frontend build key. Create `apps/web/.env.production` with the
   publishable key (safe to commit; publishable keys ship in the bundle):
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_...   # or pk_test_... for Path B
   ```
   Without this, the deployed frontend shows no sign-in until rebuilt with it.
4. Deploy:
   ```bash
   pnpm turbo deploy
   ```
   This builds the web app (baking in the key from step 3) and deploys the
   Worker + static assets.

---

## Notes

- **Order matters.** `VITE_CLERK_PUBLISHABLE_KEY` must be set at build time;
  backend secrets can be set before or after a deploy.
- **Rotate** the dev Google client secret that was shared in chat earlier. Clerk
  dev does not use it, but it is good hygiene.
- Local dev keys live in `apps/api/.dev.vars` and `apps/web/.env.local` (both
  gitignored). Refresh with
  `npx clerk env pull --app app_3FJAeiPJvMuQS9Yfo3X0ivLoaRO --file apps/api/.dev.vars`.
