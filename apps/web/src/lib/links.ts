import type { TripLink } from "../api";

/**
 * Ensure a user-typed URL has a scheme so it works as an href and passes
 * the contract's `z.string().url()` check. Bare hosts like
 * "maps.app.goo.gl/abc" become "https://maps.app.goo.gl/abc".
 */
export function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return url;
  return `https://${url}`;
}

/** Drop blank rows and normalise URLs before sending to the API. */
export function cleanLinks(
  links: { name: string; url: string }[]
): TripLink[] {
  return links
    .map((l) => ({ name: l.name.trim(), url: normalizeUrl(l.url) }))
    .filter((l) => l.name && l.url);
}
