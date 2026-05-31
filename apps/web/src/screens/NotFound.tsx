import React from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <div className="content" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px" }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>🧭</div>
        <div className="h1">Off the map</div>
        <p className="muted" style={{ marginBottom: 24 }}>
          This route doesn&apos;t lead anywhere. Maybe the trail washed out.
        </p>
        <Button variant="primary" onClick={() => navigate("/")}>
          Back to base camp
        </Button>
      </div>
    </div>
  );
}
