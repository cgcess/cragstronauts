import { createContext, useContext } from "react";

const TripContext = createContext(null);

export function TripProvider({ children, value }) {
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTripContext() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error("useTripContext must be used within a TripProvider");
  }
  return context;
}
