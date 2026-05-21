import React, { useEffect, useState } from "react";

/**
 * AlpsBackground
 * Cycles a curated set of alpine landscape photographs as a fixed
 * background. Deterministic by wall-clock so the image is the same
 * across a 4-hour window for everyone hitting the app (no per-load
 * shuffle, no flicker on navigation).
 *
 * Swap the IMAGES list with licensed/preferred photos at any time —
 * each entry just needs { src, credit? }.
 */

// Unsplash direct URLs (free to use under the Unsplash License).
// Picked for an alpine "grass and rock" mood with sky blue + earthy brown.
const IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=70",
    credit: "Kalen Emsley · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?auto=format&fit=crop&w=1600&q=70",
    credit: "Pietro De Grandi · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1454942901704-3c44c11b2ad1?auto=format&fit=crop&w=1600&q=70",
    credit: "Aaron Burden · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=70",
    credit: "David Marcu · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=70",
    credit: "Joshua Earle · Unsplash",
  },
];

const CYCLE_MS = 4 * 60 * 60 * 1000; // 4 hours

function pickIndex(now = Date.now()) {
  return Math.floor(now / CYCLE_MS) % IMAGES.length;
}

export default function AlpsBackground() {
  const [idx, setIdx] = useState(() => pickIndex());

  useEffect(() => {
    // Preload the *next* image so the swap is seamless.
    const next = IMAGES[(idx + 1) % IMAGES.length];
    const pre = new Image();
    pre.src = next.src;
  }, [idx]);

  useEffect(() => {
    // Re-evaluate at the next 4-hour boundary (no need to tick every minute).
    const now = Date.now();
    const msUntilBoundary = CYCLE_MS - (now % CYCLE_MS);
    const t = setTimeout(() => setIdx(pickIndex()), msUntilBoundary + 500);
    return () => clearTimeout(t);
  }, [idx]);

  const current = IMAGES[idx];

  return (
    <>
      <div
        className="alps-bg"
        style={{ backgroundImage: `url(${current.src})` }}
        aria-hidden="true"
      />
      <div className="alps-bg-credit" aria-hidden="true">
        {current.credit}
      </div>
    </>
  );
}
