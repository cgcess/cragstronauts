import React from "react";

/**
 * GlassFilter — SVG filter defs for the liquid-glass nav surfaces.
 *
 * Referenced from styles.css via `backdrop-filter: url(#glass-refraction)`.
 * The <svg> itself has zero painted area — only the <defs> are used.
 *
 * Filter chain:
 *   1. Edge-only refraction (feTurbulence + feDisplacementMap)
 *   2. Chromatic aberration (per-channel displacement at different scales)
 *   3. Specular highlight (feSpecularLighting dome)
 *   4. Post — frost blur + saturation boost
 */
export default function GlassFilter() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute", overflow: "hidden" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="glass-refraction" x="0%" y="0%" width="100%" height="100%">
          {/* 1. Fractal noise */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015 0.018"
            numOctaves="2"
            seed="7"
            result="noise"
          />

          {/* 2. Edge-fade alpha mask (white rim, transparent center) */}
          <feImage
            href="data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3CradialGradient%20id%3D%22g%22%20cx%3D%2250%22%20cy%3D%2250%22%20r%3D%2260%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%3Cstop%20offset%3D%220.55%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22white%22%20stop-opacity%3D%221%22%2F%3E%3C%2FradialGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22url(%23g)%22%2F%3E%3C%2Fsvg%3E"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="edgeMask"
          />

          {/* 3. Mask noise to edges only */}
          <feComposite in="noise" in2="edgeMask" operator="in" result="edgeNoise" />

          {/* 4. Gray base + edge noise = displacement map (center = no displacement) */}
          <feFlood floodColor="#808080" result="grayBase" />
          <feComposite in="edgeNoise" in2="grayBase" operator="over" result="displaceMap" />

          {/* 5. Chromatic aberration — R/G/B displaced at slightly different scales */}
          <feColorMatrix in="SourceGraphic"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="srcR" />
          <feDisplacementMap in="srcR" in2="displaceMap" scale="20"
            xChannelSelector="R" yChannelSelector="G"
            result="dispR" />
          <feColorMatrix in="SourceGraphic"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="srcG" />
          <feDisplacementMap in="srcG" in2="displaceMap" scale="18"
            xChannelSelector="R" yChannelSelector="G"
            result="dispG" />
          <feColorMatrix in="SourceGraphic"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="srcB" />
          <feDisplacementMap in="srcB" in2="displaceMap" scale="16"
            xChannelSelector="R" yChannelSelector="G"
            result="dispB" />
          <feBlend in="dispR" in2="dispG" mode="screen" result="dispRG" />
          <feBlend in="dispRG" in2="dispB" mode="screen" result="displaced" />

          {/* 6. Specular highlight — dome height map from inverted edge mask */}
          <feColorMatrix in="edgeMask"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1 1"
            result="heightMap" />
          <feSpecularLighting in="heightMap"
            surfaceScale="1.5"
            specularConstant="0.35"
            specularExponent="80"
            lightingColor="white"
            result="specRaw">
            <feDistantLight azimuth="135" elevation="60" />
          </feSpecularLighting>
          <feComposite in="specRaw" in2="SourceGraphic" operator="in" result="spec" />
          <feComposite in="displaced" in2="spec" operator="arithmetic"
            k1="0" k2="1" k3="1" k4="0" result="lit" />

          {/* 7. Post — frost + saturation */}
          <feGaussianBlur in="lit" stdDeviation="2" result="blurred" />
          <feColorMatrix in="blurred" type="saturate" values="1.8" />
        </filter>
      </defs>
    </svg>
  );
}
