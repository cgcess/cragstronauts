import React, { useEffect, useState } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { api } from "../api.js";
import InfoTab from "./InfoTab.jsx";
import CarsTab from "./CarsTab.jsx";
import GearTab from "./GearTab.jsx";

const TABS = [
  { id: "info", label: "Info", icon: "📍" },
  { id: "cars", label: "Cars", icon: "🚗" },
  { id: "gear", label: "Gear", icon: "🎒" },
];

export default function MainTabs({
  tripId,
  trip,
  users,
  categories,
  currentUserId,
  onRefresh,
  onSwitchUser,
  onExitTrip,
  onDeleteTrip,
})  {
  const [tab, setTab] = useState("info");
  const [cars, setCars] = useState([]);
  const [gear, setGear] = useState([]);
  const [error, setError] = useState(null);

  const reload = async () => {
    setError(null);
    try {
      const [c, g] = await Promise.all([
        api.listCars(tripId),
        api.listGear(tripId),
      ]);
      setCars(c);
      setGear(g);
      await onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line
  }, [tripId]);

  const me = users.find((u) => u.id === currentUserId);

  return (
    <div className="app-shell">
      {/* Topbar lives OUTSIDE .content so it stays pinned while the tab
          content scrolls beneath it. Mirrors the tabbar's role at the bottom. */}
      <div className="topbar">
        {error && <div className="error-banner">{error}</div>}
        <div className="row between">
          <button className="nav-pill" onClick={onExitTrip}>
            ← Trips
          </button>
          <div className="muted" style={{ fontSize: 13 }}>
            <strong style={{ color: "var(--fg)" }}>{me?.name}</strong>
            {me?.is_organizer && " 👑"}
          </div>
          <button className="nav-pill" onClick={onSwitchUser}>
            Switch
          </button>
        </div>
      </div>

      <div className="content content--tabs">
        {tab === "info" && (
          <InfoTab
            tripId={tripId}
            trip={trip}
            users={users}
            categories={categories}
            currentUserId={currentUserId}
            isOrganizer={me?.is_organizer}
            onChanged={reload}
            onDeleteTrip={onDeleteTrip}
          />
        )}
        {tab === "cars" && (
          <CarsTab
            tripId={tripId}
            trip={trip}
            cars={cars}
            users={users}
            currentUserId={currentUserId}
            onChanged={reload}
          />
        )}
        {tab === "gear" && (
          <GearTab
            tripId={tripId}
            trip={trip}
            categories={categories}
            gear={gear}
            currentUserId={currentUserId}
            onChanged={reload}
          />
        )}
      </div>

      <LayoutGroup>
        <div className="tabbar">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="tab-pill"
                  className="tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                />
              )}
              <span className="icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
