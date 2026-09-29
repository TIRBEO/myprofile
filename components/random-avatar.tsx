/* Deterministic cartoon avatar — the same seed (username) always gets
   the same face; different seeds land on one of many combinations. */

"use client";

import { useId } from "react";

const SKINS = ["#f2c9a0", "#e0ac69", "#c68642", "#8d5524", "#ffdbac", "#a9714b"];
const HAIRS = ["#2b2118", "#4a3728", "#1c1c1e", "#5b3a29", "#7c4a21", "#33302e"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function RandomAvatar({ seed, className }: { seed: string; className?: string }) {
  const h = hash(seed || "tirbeo");
  const hue = h % 360;
  const skin = SKINS[(h >> 3) % SKINS.length];
  const hairColor = HAIRS[(h >> 6) % HAIRS.length];
  const style = (h >> 9) % 4;
  const shirt = `hsl(${(hue + 180) % 360} 28% 32%)`;
  const bg1 = `hsl(${hue} 62% 55%)`;
  const bg2 = `hsl(${(hue + 40) % 360} 55% 38%)`;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = `av${h}${uid}`;

  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg1} />
          <stop offset="1" stopColor={bg2} />
        </linearGradient>
        <clipPath id={`c${id}`}>
          <circle cx="48" cy="48" r="48" />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${id})`}>
        <rect width="96" height="96" fill={`url(#g${id})`} />
        <circle cx="48" cy="112" r="40" fill={shirt} />
        <circle cx="48" cy="46" r="22" fill={skin} />
        {style === 0 ? (
          <path d="M26 44a22 22 0 0 1 44 0v-8a22 18 0 0 0-44 0z" fill={hairColor} />
        ) : null}
        {style === 1 ? (
          <path d="M26 46a22 22 0 0 1 44 0c0-16-8-26-22-26s-22 10-22 26z" fill={hairColor} />
        ) : null}
        {style === 2 ? (
          <g fill={hairColor}>
            <path d="M26 46a22 22 0 0 1 44 0c0-16-8-26-22-26s-22 10-22 26z" />
            <circle cx="26" cy="52" r="7" />
            <circle cx="70" cy="52" r="7" />
          </g>
        ) : null}
        {style === 3 ? (
          <path d="M27 42a21 21 0 0 1 42 0l-5-8a25 15 0 0 0-32 0z" fill={hairColor} />
        ) : null}
        <circle cx="41" cy="46" r="2.4" fill="#1c1c1e" />
        <circle cx="55" cy="46" r="2.4" fill="#1c1c1e" />
        <path
          d="M42 55q6 5 12 0"
          stroke="#1c1c1e"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
