// Re-export the wrangler-generated Env so the rest of the code has a single
// import to lean on, augmented with the Clerk keys the auth middleware reads.
// Supplied via `.dev.vars` locally and Worker vars/secrets in production
// (CLERK_PUBLISHABLE_KEY is safe to expose; CLERK_SECRET_KEY is a secret).
export type Env = Cloudflare.Env & {
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_SECRET_KEY: string;
};
