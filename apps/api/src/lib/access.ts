export type TripAction = "join" | "read-summary" | "member";

export type AccessDecision =
  | { allow: true }
  | { allow: false; status: 401 }
  | { allow: false; status: 403 };

// Trip privacy policy. Public: anyone. Private: sign-in required (401); members
// may do anything; non-members may only join or read the summary (else 403).
export function decideTripAccess(args: {
  isPublic: boolean;
  signedIn: boolean;
  isMember: boolean;
  action: TripAction;
}): AccessDecision {
  const { isPublic, signedIn, isMember, action } = args;

  if (isPublic) return { allow: true };
  if (!signedIn) return { allow: false, status: 401 };
  if (isMember) return { allow: true };
  if (action === "join" || action === "read-summary") return { allow: true };
  return { allow: false, status: 403 };
}
