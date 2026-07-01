// Clerk is required. The publishable key is baked in at build time from
// VITE_CLERK_PUBLISHABLE_KEY (see apps/web/.env.*). It is safe to expose — it
// ships in the client bundle. If it's missing we fail fast rather than silently
// degrade to a sign-in-less app.
const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!key) {
  throw new Error(
    "VITE_CLERK_PUBLISHABLE_KEY is not set. Run bin/fetch-secrets (or copy .env.example to .env.local and fill it in) before building."
  );
}

export const clerkPublishableKey: string = key;
