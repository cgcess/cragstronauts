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
  // Rock + crag mood — added for the climbing-trip vibe.
  {
    src: "https://images.unsplash.com/photo-1580687104139-9d51ce55e346?auto=format&fit=crop&w=1600&q=70",
    credit: "Mitchell Luo · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1629246479433-80f8a41574b0?auto=format&fit=crop&w=1600&q=70",
    credit: "Maxim Boldyrev · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1629246479981-457f396bb41d?auto=format&fit=crop&w=1600&q=70",
    credit: "Maxim Boldyrev · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1598171182250-62e92d5a3172?auto=format&fit=crop&w=1600&q=70",
    credit: "K8 · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1525857597365-5f6dbff2e36e?auto=format&fit=crop&w=1600&q=70",
    credit: "Zoltan Tasi · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1544098281-073ae35c98b0?auto=format&fit=crop&w=1600&q=70",
    credit: "Emile Guillemot · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1568051864106-6c9b883e24a6?auto=format&fit=crop&w=1600&q=70",
    credit: "Adrien Olichon · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1500823075810-5ca0b9eebe85?auto=format&fit=crop&w=1600&q=70",
    credit: "Mounzer · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1592829987165-afc0dfbaadc3?auto=format&fit=crop&w=1600&q=70",
    credit: "Beniamin Şinca · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1645649261389-a284c48d751c?auto=format&fit=crop&w=1600&q=70",
    credit: "Wolfgang Hasselmann · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1768591189220-5d6df21da38a?auto=format&fit=crop&w=1600&q=70",
    credit: "Florian Schindler · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1709983128270-c7ec7e97ce4a?auto=format&fit=crop&w=1600&q=70",
    credit: "Zoshua Colah · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1718652201710-4a51b62031ca?auto=format&fit=crop&w=1600&q=70",
    credit: "Brandon Stoll · Unsplash",
  },
  // Second crag batch — more rock + birds + climbing details.
  {
    src: "https://images.unsplash.com/photo-1730235172196-f0542b084c21?auto=format&fit=crop&w=1600&q=70",
    credit: "Csaba Gyulavári · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1578388238189-03d2317200f2?auto=format&fit=crop&w=1600&q=70",
    credit: "Sincerely Media · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1710302053239-7ed1a5714aad?auto=format&fit=crop&w=1600&q=70",
    credit: "Blaire Harmon · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1584382388740-c25cf63c2ef6?auto=format&fit=crop&w=1600&q=70",
    credit: "Nathan Dumlao · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1733107931656-d3fa581bb77a?auto=format&fit=crop&w=1600&q=70",
    credit: "Brandon Stoll · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1732024876466-9ed3191d9b99?auto=format&fit=crop&w=1600&q=70",
    credit: "Andrei Castanha · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1715792967352-82d26ce1f15e?auto=format&fit=crop&w=1600&q=70",
    credit: "Brandon Stoll · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1715792547287-600326625f0b?auto=format&fit=crop&w=1600&q=70",
    credit: "Brandon Stoll · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1696381476730-648c302120c8?auto=format&fit=crop&w=1600&q=70",
    credit: "Adam Skrinnikoff · Unsplash",
  },
  {
    src: "https://images.unsplash.com/photo-1730650403169-57ae2e9938cb?auto=format&fit=crop&w=1600&q=70",
    credit: "Brandon Stoll · Unsplash",
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
