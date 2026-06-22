// The one and only seam to where a profile is stored. Today that's the signed-in
// Clerk account's `unsafeMetadata.profile` (client-writable, which is exactly right
// for self-owned data — no backend needed). If we later move to a `ProfileDO`,
// only this file changes; the dialog/UI talk to `useProfile()` and never to Clerk.
//
// Stored shape is namespaced and versioned (`v`) so a future bump (or a migration
// to the DO) can be detected and upgraded without bricking existing kits.

import { useCallback, useMemo, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { z } from "zod";

export const DIETS = ["omnivore", "vegetarian", "vegan"] as const;
export type Diet = (typeof DIETS)[number];

export const COMPANION_TYPES = ["dog", "cat", "kid"] as const;
export type CompanionType = (typeof COMPANION_TYPES)[number];

export const ProfileCarSchema = z.object({
  id: z.string(),
  seats: z.number().int().min(1).max(12),
  name: z.string().optional(),
});
export type ProfileCar = z.infer<typeof ProfileCarSchema>;

export const ProfileGearSchema = z.object({
  id: z.string(),
  slug: z.string(),
  values: z.record(z.union([z.number(), z.string()])).optional(),
});
export type ProfileGear = z.infer<typeof ProfileGearSchema>;

export const ProfileCompanionSchema = z.object({
  id: z.string(),
  type: z.enum(COMPANION_TYPES),
  name: z.string(),
});
export type ProfileCompanion = z.infer<typeof ProfileCompanionSchema>;

export const CragProfileSchema = z.object({
  v: z.literal(1),
  username: z.string().optional(),
  diet: z.enum(DIETS).optional(),
  canLeadClimb: z.boolean().optional(),
  canLeadBelay: z.boolean().optional(),
  cars: z.array(ProfileCarSchema).default([]),
  gear: z.array(ProfileGearSchema).default([]),
  companions: z.array(ProfileCompanionSchema).default([]),
});
export type CragProfile = z.infer<typeof CragProfileSchema>;

export const EMPTY_PROFILE: CragProfile = { v: 1, cars: [], gear: [], companions: [] };

/**
 * Tolerant parse: never throws, always returns a usable profile. On a clean hit
 * we take the parsed value; otherwise we salvage whatever individual fields are
 * well-formed and drop the rest, so hand-edited or older metadata can't brick the
 * UI. Arrays fall back to empty rather than failing the whole object.
 */
export function normalizeProfile(raw: unknown): CragProfile {
  const parsed = CragProfileSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    return {
      v: 1,
      username: typeof r.username === "string" ? r.username : undefined,
      diet: (DIETS as readonly string[]).includes(r.diet as string)
        ? (r.diet as Diet)
        : undefined,
      canLeadClimb: typeof r.canLeadClimb === "boolean" ? r.canLeadClimb : undefined,
      canLeadBelay: typeof r.canLeadBelay === "boolean" ? r.canLeadBelay : undefined,
      cars: z.array(ProfileCarSchema).catch([]).parse(r.cars),
      gear: z.array(ProfileGearSchema).catch([]).parse(r.gear),
      companions: z.array(ProfileCompanionSchema).catch([]).parse(r.companions),
    };
  }
  return EMPTY_PROFILE;
}

export interface UseProfile {
  /** Clerk has finished loading the user. */
  ready: boolean;
  /** Someone is signed in (a profile can be saved). */
  signedIn: boolean;
  /** The current, normalized profile (empty when none saved yet). */
  profile: CragProfile;
  /** Persist a new profile. Throws if signed out or the network write fails. */
  save: (next: CragProfile) => Promise<void>;
  saving: boolean;
}

export function useProfile(): UseProfile {
  const { isLoaded, user } = useUser();
  const profile = useMemo(
    () =>
      normalizeProfile(
        (user?.unsafeMetadata as { profile?: unknown } | undefined)?.profile
      ),
    [user?.unsafeMetadata]
  );
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (next: CragProfile) => {
      if (!user) throw new Error("Sign in to save your profile.");
      setSaving(true);
      try {
        await user.update({
          unsafeMetadata: { ...(user.unsafeMetadata ?? {}), profile: next },
        });
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  return { ready: isLoaded, signedIn: !!user, profile, save, saving };
}
