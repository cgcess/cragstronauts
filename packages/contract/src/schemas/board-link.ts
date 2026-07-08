import { z } from "zod";

// The deep-link seam shared by the API (which encodes a push `url`) and the web
// board (which decodes the query on load to open the right card or scroll to the
// right section). Keeping the convention — the param name, the valid targets,
// and both the build and parse functions — in one module means a rename can't
// drift between encoder and decoder.
//
// The first six values match the dashboard tile ids exactly (so the web side
// needs no translation table); `announcements` is the inline feed at the bottom
// of the board.
export const BOARD_SECTIONS = [
  "cars",
  "polls",
  "gear",
  "dogs",
  "expenses",
  "roster",
  "announcements",
] as const;
export const BoardSectionSchema = z.enum(BOARD_SECTIONS);
export type BoardSection = z.infer<typeof BoardSectionSchema>;

// The query-param name a deep link uses (`?card=cars`).
export const BOARD_SECTION_PARAM = "card";

/**
 * Build the board path, optionally deep-linking to a section. This is the single
 * builder the API push call sites use for the notification `url`.
 */
export function boardPath(tripId: string, section?: BoardSection): string {
  const base = `/trips/${tripId}/board`;
  return section ? `${base}?${BOARD_SECTION_PARAM}=${section}` : base;
}

// Structural view of the one method we need, so this package stays DOM-free
// (its tsconfig `lib` is `ESNext` only). A real `URLSearchParams` satisfies it.
type QueryParams = { get(name: string): string | null };

/**
 * Read the deep-link section from a URL's query params, returning it only when
 * it is a known section (else `null`). Used by the board on load.
 */
export function parseBoardSection(params: QueryParams): BoardSection | null {
  const value = params.get(BOARD_SECTION_PARAM);
  const parsed = BoardSectionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
