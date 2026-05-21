import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import InfoTab from "./InfoTab.jsx";
import CarsTab from "./CarsTab.jsx";
import GearTab from "./GearTab.jsx";

export default function MainTabs({
  trip,
  users,
  categories,
  currentUserId,
  onRefresh,
  onSwitchUser,
  onExitTrip,
  onDeleteTrip,
}) {
  const [tab, setTab] = useState("info");
  const [cars, setCars] = useState([]);
  const [gear, setGear] = useState([]);
  const [error, setError] = useState(null);

  const reload = async () => {
    setError(null);
    try {
      const [c, g] = await Promise.all([
        api.listCars(trip.id),
        api.listGear(trip.id),
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
  }, [trip.id]);

  const me = users.find((u) => u.id === currentUserId);

  return (
    <div className="app-shell">
      <div className="content">
        {error && <div className="error-banner">{error}</div>}
        <div className="row between">
          <button className="ghost" onClick={onExitTrip}>
            ← Trips
          </button>
          <div className="muted" style={{ fontSize: 13 }}>
            <strong style={{ color: "var(--fg)" }}>{me?.name}</strong>
            {me?.is_organizer && " 👑"}
          </div>
          <button className="ghost" onClick={onSwitchUser}>
            Switch
          </button>
        </div>

        {tab === "info" && (
          <InfoTab
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
            trip={trip}
            cars={cars}
            users={users}
            currentUserId={currentUserId}
            onChanged={reload}
          />
        )}
        {tab === "gear" && (
          <GearTab
            trip={trip}
            categories={categories}
            gear={gear}
            currentUserId={currentUserId}
            onChanged={reload}
          />
        )}
      </div>

      <div className="tabbar">
        <button
          className={tab === "info" ? "active" : ""}
          onClick={() => setTab("info")}
        >
          <span className="icon">📍</span>
          Info
        </button>
        <button
          className={tab === "cars" ? "active" : ""}
          onClick={() => setTab("cars")}
        >
          <span className="icon">🚗</span>
          Cars
        </button>
        <button
          className={tab === "gear" ? "active" : ""}
          onClick={() => setTab("gear")}
        >
          <span className="icon">🎒</span>
          Gear
        </button>
      </div>
    </div>
  );
}
