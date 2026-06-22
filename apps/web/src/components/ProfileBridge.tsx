import { useEffect } from "react";
import { useProfile, type CragProfile } from "../lib/profile";

// Lifts the signed-in user's profile up to TripLayout so the join questionnaire
// can prefill from it. Mirrors TripAccountSync's gating: only mounted when Clerk
// is enabled (inside ClerkProvider), so the public no-Clerk path never calls
// Clerk hooks. Reports null when signed out / not ready.
export default function ProfileBridge({
  onProfile,
}: {
  onProfile: (p: CragProfile | null) => void;
}) {
  const { ready, signedIn, profile } = useProfile();
  useEffect(() => {
    onProfile(ready && signedIn ? profile : null);
  }, [ready, signedIn, profile, onProfile]);
  return null;
}
