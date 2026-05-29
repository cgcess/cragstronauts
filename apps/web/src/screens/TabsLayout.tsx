import React, { useEffect, useState } from "react";
import { Outlet, NavLink, Navigate, useNavigate, useLocation } from "react-router";
import { motion, LayoutGroup } from "framer-motion";
import { api } from "../api";
import { useTripContext } from "../context/TripContext";
import type { z } from "zod";
import type { CarSchema, GearContributionSchema } from "@cragstronauts/contract";

type Car = z.infer<typeof CarSchema>;
type Contribution = z.infer<typeof GearContributionSchema>;

export interface TabsOutletContext {
  cars: Car[];
  gear: Contribution[];
  reload: () => Promise<void>;
}

const TABS = [
  { id: "info", label: "Info", icon: "📍" },
  { id: "cars", label: "Cars", icon: "🚗" },
  { id: "gear", label: "Gear", icon: "🎒" },
];

export default function TabsLayout() {
  const {
    tripId,
    trip,
    users,
    currentUserId,
    switchUser,
    refresh,
  } = useTripContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [cars, setCars] = useState<Car[]>([]);
  const [gear, setGear] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const [c, g] = await Promise.all([
        api.listCars(tripId),
        api.listGear(tripId),
      ]);
      setCars(c);
      setGear(g);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [tripId]);

  const me = users.find((u) => u.id === currentUserId);

  // Guard: no user selected → back to landing
  if (!currentUserId || !me) {
    return <Navigate to={`/trips/${tripId}`} replace />;
  }

  // Guard: signup not completed → redirect to signup
  if (!me.signup_completed) {
    return <Navigate to={`/trips/${tripId}/signup`} replace />;
  }

  // Determine active tab from current path
  const pathEnd = location.pathname.split("/").pop();
  const activeTab = TABS.find((t) => t.id === pathEnd)?.id || "info";

  return (
    <div className="app-shell">
      <div className="topbar">
        {error && <div className="error-banner">{error}</div>}
        <div className="row between">
          <button
            className="glass-surface nav-pill"
            onClick={() => navigate("/")}
          >
            ← Trips
          </button>
          <div className="glass-surface nav-cap">
            <strong>{me.name}</strong>
            {me.is_organizer && " 👑"}
          </div>
          <button
            className="glass-surface nav-pill"
            onClick={() => {
              switchUser();
              navigate(`/trips/${tripId}`);
            }}
          >
            Switch
          </button>
        </div>
      </div>

      <div className="content content--tabs">
        <Outlet context={{ cars, gear, reload } satisfies TabsOutletContext} />
      </div>

      <LayoutGroup>
        <div className="glass-surface tabbar">
          {TABS.map((t) => (
            <NavLink
              key={t.id}
              to={t.id}
              className={activeTab === t.id ? "active" : ""}
            >
              {activeTab === t.id && (
                <motion.span
                  layoutId="tab-pill"
                  className="tab-pill"
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                    mass: 0.8,
                  }}
                />
              )}
              <span className="icon">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
