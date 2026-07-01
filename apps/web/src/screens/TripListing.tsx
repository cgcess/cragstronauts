import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router";

export default function TripListing() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <div className="app-shell">
      <div className="fade-overlay fade-overlay--top" aria-hidden="true" />
      <div className="content">
        <div className="column">
        <motion.div
          className="fl-brand"
          initial={reduceMotion ? false : { opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32 }}
        >
          <span className="fl-brand__glyph">🧗</span>
          Cragstronauts
        </motion.div>
        <div className="fl-brand__sub">Plan the climb. Pack the car.</div>

        <motion.button
          type="button"
          className="fl-empty"
          onClick={() => navigate("/trips/new")}
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.1 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="fl-empty__plus">+</div>
          <div className="fl-empty__title">Plan a new trip</div>
          <div className="fl-empty__sub">Tap to start your next cragstronaut mission.</div>
        </motion.button>
        </div>
      </div>
    </div>
  );
}
