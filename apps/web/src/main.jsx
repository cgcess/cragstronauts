import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// NOTE: StrictMode was deadlocking framer-motion's AnimatePresence
// (cards stuck at opacity 0 on first mount). Disabled until we move to
// a more StrictMode-tolerant animation pattern.
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
