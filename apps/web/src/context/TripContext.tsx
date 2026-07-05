import { createContext, useContext, type ReactNode } from "react";
import type { z } from "zod";
import type {
  TripSchema,
  UserSchema,
  GearCategorySchema,
  GearContributionSchema,
  GearDeclineSchema,
  PollSchema,
  PollAnswerSchema,
} from "@cragstronauts/contract";

export type Trip = z.infer<typeof TripSchema>;
export type User = z.infer<typeof UserSchema>;
export type Category = z.infer<typeof GearCategorySchema>;
export type GearContribution = z.infer<typeof GearContributionSchema>;
export type GearDecline = z.infer<typeof GearDeclineSchema>;
export type Poll = z.infer<typeof PollSchema>;
export type PollAnswer = z.infer<typeof PollAnswerSchema>;

export interface TripContextValue {
  tripId: string;
  trip: Trip;
  users: User[];
  categories: Category[];
  gear: GearContribution[];
  gearDeclines: GearDecline[];
  polls: Poll[];
  pollAnswers: PollAnswer[];
  currentUserId: number | null;
  setUser: (userId: number | null) => void;
  switchUser: () => void;
  /**
   * Resolve the current user's id, opening the identity sheet if nobody is
   * identified yet. Resolves with the id once the visitor identifies, or
   * `null` if they dismiss the sheet. Lets a write action resume seamlessly
   * after lazily creating/selecting a user.
   */
  ensureUser: () => Promise<number | null>;
  /**
   * Open the nudge deck for the current user, pre-filtered to the polls and
   * gear categories they still need to answer. Used by the dashboard nudge
   * card. No-op if nobody is identified yet or both lists are empty.
   */
  openQuestions: (polls: Poll[], categories?: Category[]) => void;
  refresh: () => Promise<void>;
  /**
   * Subscribe to real-time "changed" signals (another participant mutated the
   * trip). Screens that hold their own fetched slices not covered by `refresh`
   * (e.g. the dashboard's cars/dogs/expenses/balances) register a reloader here
   * so they update live too. Returns an unsubscribe function.
   */
  subscribeToChanges: (listener: () => void) => () => void;
  deleteTrip: () => Promise<void>;
  /** Join a private trip as the signed-in account, then load member data. */
  joinPrivateTrip: () => Promise<void>;
}

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ children, value }: { children: ReactNode; value: TripContextValue }) {
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTripContext(): TripContextValue {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error("useTripContext must be used within a TripProvider");
  }
  return context;
}
