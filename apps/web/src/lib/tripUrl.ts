/** Lowercase a-z0-9 slug, hyphen-separated. Empty string if nothing usable. */
export function slugify(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a shareable trip path: `/trips/<slug>-<id>` (+ optional sub-route).
 * The slug is cosmetic — only the trailing 64-char id is used for lookup, so
 * the link stays valid even after the trip's name changes.
 */
export function tripPath(
  name: string | null | undefined,
  id: string,
  sub?: "board"
): string {
  const slug = slugify(name);
  const stem = slug ? `${slug}-${id}` : id;
  return sub ? `/trips/${stem}/${sub}` : `/trips/${stem}`;
}

/**
 * Pull the canonical trip id (the trailing 64-char hex) out of a URL param.
 * Accepts both slugged (`moab-<id>`) and bare (`<id>`) forms, so links shared
 * before slugs existed keep resolving.
 */
export function extractTripId(param: string): string {
  const match = param.match(/[0-9a-f]{64}$/i);
  return match ? match[0] : param;
}
