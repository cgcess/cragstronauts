import { createContext, useContext, type ReactNode } from "react";
import type { z } from "zod";
import type {
  TripSchema,
  UserSchema,
  GearCategorySchema,
  PollSchema,
  PollAnswerSchema,
} from "@cragstronauts/contract";

export type Trip = z.infer<typeof TripSchema>;
export type User = z.infer<typeof UserSchema>;
export type Category = z.infer<typeof GearCategorySchema>;
export type Poll = z.infer<typeof PollSchema>;
export type PollAnswer = z.infer<typeof PollAnswerSchema>;

export interface TripContextValue {
  tripId: string;
  trip: Trip;
  users: User[];
  categories: Category[];
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
  refresh: () => Promise<void>;
  deleteTrip: () => Promise<void>;
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
