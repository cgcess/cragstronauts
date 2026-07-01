// Canonical, predefined gear catalog — the shared vocabulary for "stuff you can
// bring on a trip". A profile picks gear from this list (rather than free text),
// and each item carries a stable `slug` so a profile item can later be matched to
// a trip's gear category. Field `key`s deliberately mirror the organizer wizard's
// default gear fields (apps/web/.../OrganizerWizard.tsx) so values line up 1:1
// when Phase 2 prefills the join questionnaire.

export interface GearCatalogField {
  key: string;
  label: string;
  type: string; // "number" for now; left open for future field kinds
}

export interface GearCatalogItem {
  slug: string;
  label: string;
  emoji: string;
  /** Optional detail fields to capture (e.g. a rope's length). */
  fields: GearCatalogField[];
}

export const GEAR_CATALOG: GearCatalogItem[] = [
  {
    slug: "rope",
    label: "Rope",
    emoji: "🪢",
    fields: [
      { key: "length", label: "Length (m)", type: "number" },
      { key: "diameter", label: "Diameter (mm)", type: "number" },
    ],
  },
  {
    slug: "quickdraws",
    label: "Quickdraws",
    emoji: "🔗",
    fields: [{ key: "count", label: "How many", type: "number" }],
  },
  {
    slug: "trad-rack",
    label: "Trad rack",
    emoji: "⚙️",
    fields: [{ key: "count", label: "How many pieces", type: "number" }],
  },
  {
    slug: "slings",
    label: "Slings",
    emoji: "➰",
    fields: [{ key: "count", label: "How many", type: "number" }],
  },
  {
    slug: "crash-pad",
    label: "Crash pad",
    emoji: "🟦",
    fields: [{ key: "count", label: "How many", type: "number" }],
  },
  {
    slug: "belay-device",
    label: "Belay device",
    emoji: "🛟",
    fields: [],
  },
  {
    slug: "stove",
    label: "Stove",
    emoji: "🔥",
    fields: [],
  },
  {
    slug: "tent",
    label: "Tent",
    emoji: "⛺",
    fields: [{ key: "sleeps", label: "Sleeps", type: "number" }],
  },
];

export const GEAR_CATALOG_BY_SLUG: Record<string, GearCatalogItem> =
  Object.fromEntries(GEAR_CATALOG.map((g) => [g.slug, g]));
