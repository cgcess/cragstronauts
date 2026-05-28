import React from "react";

// Matches http(s):// URLs and bare www. URLs.
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

// Punctuation that commonly trails a URL in prose but isn't part of it.
const TRAILING_RE = /[.,;:!?)\]}'"]+$/;

export default function Linkify({ children }) {
  const text = typeof children === "string" ? children : "";
  if (!text) return children ?? null;

  const parts = [];
  let lastIndex = 0;
  let match;
  URL_RE.lastIndex = 0;

  while ((match = URL_RE.exec(text)) !== null) {
    const start = match.index;
    let url = match[0];

    const trailing = url.match(TRAILING_RE);
    let trail = "";
    if (trailing) {
      trail = trailing[0];
      url = url.slice(0, url.length - trail.length);
    }

    if (start > lastIndex) parts.push(text.slice(lastIndex, start));

    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a key={start} href={href} target="_blank" rel="noopener noreferrer">
        {url}
      </a>
    );
    if (trail) parts.push(trail);

    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <>{parts}</>;
}
