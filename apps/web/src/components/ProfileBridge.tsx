import { useEffect } from "react";
import { useProfile, type CragProfile } from "../lib/profile";

// Lifts the signed-in user's profile up to TripLayout so the join questionnaire
// can prefill from it, along with the account's own display name (used to
// prefill the join name for a member who hasn't set a username yet). Reports
// null when signed out / not ready.
export default function ProfileBridge({
  onProfile,
  onAccountName,
}: {
  onProfile: (p: CragProfile | null) => void;
  onAccountName: (name: string | null) => void;
}) {
  const { ready, signedIn, profile, accountName } = useProfile();
  useEffect(() => {
    const on = ready && signedIn;
    onProfile(on ? profile : null);
    onAccountName(on ? accountName ?? null : null);
  }, [ready, signedIn, profile, accountName, onProfile, onAccountName]);
  return null;
}
