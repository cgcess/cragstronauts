// Re-export the wrangler-generated Env so the rest of the code has a single
// import to lean on, augmented with the Clerk keys the auth middleware reads.
// Supplied via `.dev.vars` locally and Worker vars/secrets in production
// (CLERK_PUBLISHABLE_KEY is safe to expose; CLERK_SECRET_KEY is a secret).
export type Env = Cloudflare.Env & {
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
  CLERK_WEBHOOK_SIGNING_SECRET: string;
  DISCORD_WEBHOOK_URL: string;
  // Web Push (VAPID). PRIVATE key is the PushForge JWK JSON string (a secret);
  // PUBLIC is the base64url application server key (also shipped to the client
  // as VITE_VAPID_PUBLIC_KEY); SUBJECT is a mailto: contact URL. When unset the
  // push path no-ops silently so local dev and CI stay quiet.
  VAPID_PRIVATE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_SUBJECT: string;
};
