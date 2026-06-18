// Clerk is optional and additive: when no publishable key is configured we skip
// it entirely and the app runs as the public, cooperative board. Components that
// use Clerk hooks/elements must only render when `clerkEnabled` is true (i.e.
// inside the ClerkProvider mounted in main.tsx).
export const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
export const clerkEnabled = Boolean(clerkPublishableKey);
