"use client";

import React, { useEffect, useRef, useState } from "react";
import { Cutive_Mono, Libre_Franklin } from "next/font/google";
import { DesignSwitcher } from "../_components/design-switcher";

/* ─── Font Configuration ─── */
const cutiveMono = Cutive_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-cutive",
});

const libreFranklin = Libre_Franklin({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-libre",
});

/* ─── Palette ─── */
const BLACK = "#1A1A1A";
const LIGHT = "#CDCDCD";
const FAINT = "#E6E6E6";
const VERMILLION = "#E63946";
const WHITE = "#FFFFFF";
const PAPER = "#FAFAFA";
const GRID_LINE = "#E0E0E0";

/* ─══════════════════════════════════════════════════════════════
   SVG PATTERN DEFINITIONS
   ══════════════════════════════════════════════════════════════ */
function HatchPatterns() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        {/* Diagonal hatching — Steel */}
        <pattern
          id="hatch-diagonal"
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke={BLACK} strokeWidth="0.4" />
        </pattern>
        {/* Concrete cross-hatching */}
        <pattern
          id="hatch-concrete"
          patternUnits="userSpaceOnUse"
          width="8"
          height="8"
        >
          <line x1="0" y1="0" x2="8" y2="8" stroke={BLACK} strokeWidth="0.3" />
          <line x1="8" y1="0" x2="0" y2="8" stroke={BLACK} strokeWidth="0.3" />
        </pattern>
        {/* Glass — parallel lines */}
        <pattern
          id="hatch-glass"
          patternUnits="userSpaceOnUse"
          width="4"
          height="8"
        >
          <line x1="0" y1="0" x2="4" y2="8" stroke={BLACK} strokeWidth="0.25" />
        </pattern>
        {/* Earth — dots */}
        <pattern
          id="hatch-earth"
          patternUnits="userSpaceOnUse"
          width="10"
          height="10"
        >
          <circle cx="2" cy="2" r="0.6" fill={BLACK} />
          <circle cx="7" cy="7" r="0.6" fill={BLACK} />
          <circle cx="5" cy="4" r="0.4" fill={BLACK} />
        </pattern>
        {/* Insulation — wavy */}
        <pattern
          id="hatch-insulation"
          patternUnits="userSpaceOnUse"
          width="16"
          height="8"
        >
          <path
            d="M0,4 Q4,0 8,4 Q12,8 16,4"
            stroke={BLACK}
            strokeWidth="0.4"
            fill="none"
          />
        </pattern>
        {/* Metal — double diagonal */}
        <pattern
          id="hatch-metal"
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="6" stroke={BLACK} strokeWidth="0.5" />
          <line x1="3" y1="0" x2="3" y2="6" stroke={BLACK} strokeWidth="0.5" />
        </pattern>
        {/* Construction grid background pattern */}
        <pattern
          id="grid-construction"
          patternUnits="userSpaceOnUse"
          width="40"
          height="40"
        >
          <line x1="0" y1="0" x2="40" y2="0" stroke={GRID_LINE} strokeWidth="0.3" />
          <line x1="0" y1="0" x2="0" y2="40" stroke={GRID_LINE} strokeWidth="0.3" />
        </pattern>
      </defs>
    </svg>
  );
}

/* ─══════════════════════════════════════════════════════════════
   SVG COMPONENT: North Arrow
   ══════════════════════════════════════════════════════════════ */
function NorthArrow({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      style={{ display: "block" }}
    >
      <line x1="24" y1="44" x2="24" y2="6" stroke={BLACK} strokeWidth="1" />
      <polygon points="24,4 20,14 24,10 28,14" fill={BLACK} />
      <text
        x="24"
        y="2"
        textAnchor="middle"
        fontSize="8"
        fontFamily="var(--font-cutive)"
        fill={BLACK}
        fontWeight="400"
      >
        N
      </text>
      <circle cx="24" cy="24" r="22" stroke={BLACK} strokeWidth="0.5" fill="none" />
    </svg>
  );
}

/* ─══════════════════════════════════════════════════════════════
   SVG COMPONENT: Scale Bar
   ══════════════════════════════════════════════════════════════ */
function ScaleBar({ width = 200, label = "1:100" }: { width?: number; label?: string }) {
  const segments = 5;
  const segW = width / segments;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
      <svg width={width} height={16} viewBox={`0 0 ${width} 16`} fill="none">
        {Array.from({ length: segments }).map((_, i) => (
          <rect
            key={`seg-${i}`}
            x={i * segW}
            y={4}
            width={segW}
            height={6}
            fill={i % 2 === 0 ? BLACK : "none"}
            stroke={BLACK}
            strokeWidth="0.75"
          />
        ))}
        {Array.from({ length: segments + 1 }).map((_, i) => (
          <line
            key={`tick-${i}`}
            x1={i * segW}
            y1={2}
            x2={i * segW}
            y2={12}
            stroke={BLACK}
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: segments + 1 }).map((_, i) => (
          <text
            key={`lbl-${i}`}
            x={i * segW}
            y={15}
            textAnchor="middle"
            fontSize="5"
            fontFamily="var(--font-cutive)"
            fill={BLACK}
          >
            {i * 10}m
          </text>
        ))}
      </svg>
      <span
        style={{
          fontFamily: "var(--font-cutive)",
          fontSize: 9,
          color: BLACK,
          letterSpacing: 1,
        }}
      >
        SCALE {label}
      </span>
    </div>
  );
}

/* ─══════════════════════════════════════════════════════════════
   SVG COMPONENT: Section Marker (circled number with leader)
   ══════════════════════════════════════════════════════════════ */
function SectionMarker({
  label,
  direction = "right",
  color = BLACK,
}: {
  label: string;
  direction?: "left" | "right" | "up" | "down";
  color?: string;
}) {
  const rotations = { right: 0, down: 90, left: 180, up: 270 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12" stroke={color} strokeWidth="1.5" fill={WHITE} />
        <line x1="14" y1="2" x2="14" y2="26" stroke={color} strokeWidth="0.5" />
        <text
          x="14"
          y="12"
          textAnchor="middle"
          fontSize="8"
          fontFamily="var(--font-cutive)"
          fontWeight="400"
          fill={color}
        >
          {label}
        </text>
        <text
          x="14"
          y="22"
          textAnchor="middle"
          fontSize="6"
          fontFamily="var(--font-cutive)"
          fill={color}
        >
          A-23
        </text>
      </svg>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        style={{ transform: `rotate(${rotations[direction]}deg)` }}
      >
        <line x1="0" y1="8" x2="12" y2="8" stroke={color} strokeWidth="1" />
        <polygon points="12,4 16,8 12,12" fill={color} />
      </svg>
    </div>
  );
}

/* ─══════════════════════════════════════════════════════════════
   SVG COMPONENT: Dimension Line (horizontal)
   ══════════════════════════════════════════════════════════════ */
function DimensionLine({
  width,
  label,
  color = BLACK,
}: {
  width: number | string;
  label: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        width: typeof width === "number" ? width : width,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-cutive)",
          fontSize: 9,
          color,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </span>
      <svg width="100%" height="8" viewBox="0 0 100 8" preserveAspectRatio="none">
        <line x1="0" y1="0" x2="0" y2="8" stroke={color} strokeWidth="0.75" />
        <line x1="100" y1="0" x2="100" y2="8" stroke={color} strokeWidth="0.75" />
        <line x1="0" y1="4" x2="100" y2="4" stroke={color} strokeWidth="0.5" />
        <polygon points="0,2 4,4 0,6" fill={color} />
        <polygon points="100,2 96,4 100,6" fill={color} />
      </svg>
    </div>
  );
}

/* ─══════════════════════════════════════════════════════════════
   SVG COMPONENT: Door Swing Arc
   ══════════════════════════════════════════════════════════════ */
function DoorSwing({ size = 40, flip = false }: { size?: number; flip?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      style={{ display: "block", transform: flip ? "scaleX(-1)" : "none" }}
    >
      <line x1="0" y1="40" x2="0" y2="0" stroke={BLACK} strokeWidth="1.5" />
      <path
        d="M0,0 A40,40 0 0,1 40,40"
        stroke={BLACK}
        strokeWidth="0.5"
        strokeDasharray="2,2"
      />
      <line x1="0" y1="0" x2="40" y2="40" stroke={BLACK} strokeWidth="0.75" />
    </svg>
  );
}

/* ─══════════════════════════════════════════════════════════════
   SVG COMPONENT: Elevation Marker (diamond with level)
   ══════════════════════════════════════════════════════════════ */
function ElevationMarker({ level, height }: { level: string; height: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <polygon points="10,0 20,10 10,20 0,10" stroke={BLACK} strokeWidth="1" fill={WHITE} />
      </svg>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: "var(--font-cutive)",
            fontSize: 9,
            color: BLACK,
            borderBottom: `0.5px solid ${BLACK}`,
            paddingBottom: 1,
          }}
        >
          {height}
        </span>
        <span
          style={{
            fontFamily: "var(--font-cutive)",
            fontSize: 8,
            color: BLACK,
          }}
        >
          {level}
        </span>
      </div>
    </div>
  );
}

/* ─══════════════════════════════════════════════════════════════
   SVG COMPONENT: Annotation Callout (dot + leader line + text)
   ══════════════════════════════════════════════════════════════ */
function AnnotationCallout({
  text,
  leaderLength = 40,
  direction = "right",
  color = VERMILLION,
}: {
  text: string;
  leaderLength?: number;
  direction?: "left" | "right";
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        flexDirection: direction === "left" ? "row-reverse" : "row",
      }}
    >
      <svg width="6" height="6" viewBox="0 0 6 6" fill="none">
        <circle cx="3" cy="3" r="2.5" fill={color} />
      </svg>
      <svg width={leaderLength} height="2" viewBox={`0 0 ${leaderLength} 2`}>
        <line x1="0" y1="1" x2={leaderLength} y2="1" stroke={color} strokeWidth="0.75" />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-cutive)",
          fontSize: 9,
          color,
          whiteSpace: "nowrap",
          letterSpacing: 0.5,
        }}
      >
        {text}
      </span>
    </div>
  );
}

/* ─══════════════════════════════════════════════════════════════
   SVG COMPONENT: Hatching Swatch (small pattern sample)
   ══════════════════════════════════════════════════════════════ */
function HatchSwatch({
  patternId,
  size = 24,
}: {
  patternId: string;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect
        width={size}
        height={size}
        fill={`url(#${patternId})`}
        stroke={BLACK}
        strokeWidth="0.75"
      />
    </svg>
  );
}

/* ─══════════════════════════════════════════════════════════════
   SVG COMPONENT: Revision Cloud
   ══════════════════════════════════════════════════════════════ */
function RevisionCloud({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const arcCount = Math.floor(width / 20);
  const vArcCount = Math.floor(height / 20);
  let d = "M 4,4";
  for (let i = 0; i < arcCount; i++) {
    const x1 = 4 + ((i + 0.5) * (width - 8)) / arcCount;
    const x2 = 4 + ((i + 1) * (width - 8)) / arcCount;
    d += ` Q ${x1},${-4} ${x2},4`;
  }
  for (let i = 0; i < vArcCount; i++) {
    const y1 = 4 + ((i + 0.5) * (height - 8)) / vArcCount;
    const y2 = 4 + ((i + 1) * (height - 8)) / vArcCount;
    d += ` Q ${width + 2},${y1} ${width - 4},${y2}`;
  }
  for (let i = arcCount - 1; i >= 0; i--) {
    const x1 = 4 + ((i + 0.5) * (width - 8)) / arcCount;
    const x2 = 4 + (i * (width - 8)) / arcCount;
    d += ` Q ${x1},${height + 2} ${x2},${height - 4}`;
  }
  for (let i = vArcCount - 1; i >= 0; i--) {
    const y1 = 4 + ((i + 0.5) * (height - 8)) / vArcCount;
    const y2 = 4 + (i * (height - 8)) / vArcCount;
    d += ` Q ${-4},${y1} 4,${y2}`;
  }
  d += " Z";

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        <path d={d} stroke={VERMILLION} strokeWidth="1.5" fill="none" />
      </svg>
      <div style={{ padding: "16px 20px", position: "relative" }}>{children}</div>
    </div>
  );
}

/* ─══════════════════════════════════════════════════════════════
   FULL-WIDTH SECTION CUT LINE
   ══════════════════════════════════════════════════════════════ */
function SectionCutLine({ label = "A" }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        gap: 0,
        margin: "32px 0",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke={BLACK} strokeWidth="1.5" fill={WHITE} />
          <text
            x="14"
            y="18"
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-cutive)"
            fill={BLACK}
          >
            {label}
          </text>
        </svg>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <polygon points="0,2 8,6 0,10" fill={BLACK} />
        </svg>
      </div>
      <div
        style={{
          flex: 1,
          height: 0,
          borderTop: `1.5px dashed ${BLACK}`,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", flexDirection: "row-reverse" }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12" stroke={BLACK} strokeWidth="1.5" fill={WHITE} />
          <text
            x="14"
            y="18"
            textAnchor="middle"
            fontSize="11"
            fontFamily="var(--font-cutive)"
            fill={BLACK}
          >
            {label}
          </text>
        </svg>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: "scaleX(-1)" }}>
          <polygon points="0,2 8,6 0,10" fill={BLACK} />
        </svg>
      </div>
    </div>
  );
}

/* ─══════════════════════════════════════════════════════════════
   CORNER TICK MARKS (decorative registration marks on panels)
   ══════════════════════════════════════════════════════════════ */
function CornerTicks({ size = 12, color = BLACK }: { size?: number; color?: string }) {
  const s = size;
  return (
    <>
      {/* Top-left */}
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        fill="none"
        style={{ position: "absolute", top: -1, left: -1 }}
      >
        <line x1="0" y1="0" x2={s} y2="0" stroke={color} strokeWidth="1" />
        <line x1="0" y1="0" x2="0" y2={s} stroke={color} strokeWidth="1" />
      </svg>
      {/* Top-right */}
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        fill="none"
        style={{ position: "absolute", top: -1, right: -1 }}
      >
        <line x1="0" y1="0" x2={s} y2="0" stroke={color} strokeWidth="1" />
        <line x1={s} y1="0" x2={s} y2={s} stroke={color} strokeWidth="1" />
      </svg>
      {/* Bottom-left */}
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        fill="none"
        style={{ position: "absolute", bottom: -1, left: -1 }}
      >
        <line x1="0" y1={s} x2={s} y2={s} stroke={color} strokeWidth="1" />
        <line x1="0" y1="0" x2="0" y2={s} stroke={color} strokeWidth="1" />
      </svg>
      {/* Bottom-right */}
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        fill="none"
        style={{ position: "absolute", bottom: -1, right: -1 }}
      >
        <line x1="0" y1={s} x2={s} y2={s} stroke={color} strokeWidth="1" />
        <line x1={s} y1="0" x2={s} y2={s} stroke={color} strokeWidth="1" />
      </svg>
    </>
  );
}

/* ─══════════════════════════════════════════════════════════════
   INTERSECTION OBSERVER HOOKS
   ══════════════════════════════════════════════════════════════ */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function Reveal({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const { ref, visible } = useReveal(0.08);
  return (
    <div
      ref={ref}
      style={{
        clipPath: visible ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
        opacity: visible ? 1 : 0,
        transition: `clip-path 0.7s cubic-bezier(0.25,0.1,0.25,1) ${delay}ms, opacity 0.5s linear ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─══════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════ */

const NAV_ITEMS = [
  { label: "ELEVATION", href: "#hero" },
  { label: "ROOM SCHEDULE", href: "#features" },
  { label: "SEQUENCE", href: "#process" },
  { label: "MATERIALS", href: "#pricing" },
  { label: "CONSTRUCT", href: "#cta" },
];

const FEATURES = [
  {
    room: "101",
    name: "Priority Algorithm",
    area: "52.0 m\u00B2",
    spec: "Multi-dimensional weighting engine. Deadlines, energy cost, and dependencies produce optimal daily schedules.",
    material: "hatch-diagonal",
    type: "PRIMARY",
  },
  {
    room: "102",
    name: "Google Calendar Sync",
    area: "36.5 m\u00B2",
    spec: "Bi-directional sync with Google Calendar. Events flow in, scheduled blocks flow out. One unified timeline.",
    material: "hatch-concrete",
    type: "PRIMARY",
  },
  {
    room: "103",
    name: "Habit Orchestration",
    area: "28.0 m\u00B2",
    spec: "Habits require rhythm, not rigid slots. Finds recurring windows respecting energy patterns and protects them.",
    material: "hatch-glass",
    type: "PRIMARY",
  },
  {
    room: "104",
    name: "Smart Rescheduling",
    area: "32.0 m\u00B2",
    spec: "When life disrupts your plan, the algorithm adapts. Missed blocks cascade forward preserving priority order.",
    material: "hatch-earth",
    type: "AUXILIARY",
  },
  {
    room: "105",
    name: "Time Horizon Planning",
    area: "24.5 m\u00B2",
    spec: "Plan up to 75 days ahead. Distributes work across your horizon, preventing deadline clustering and overload.",
    material: "hatch-insulation",
    type: "AUXILIARY",
  },
  {
    room: "106",
    name: "Analytics Dashboard",
    area: "20.0 m\u00B2",
    spec: "Completion rates, scheduling efficiency, habit streaks, peak productivity windows. Data-driven time insight.",
    material: "hatch-metal",
    type: "SECONDARY",
  },
];

const PHASES = [
  {
    phase: "01",
    title: "FOUNDATION",
    subtitle: "Define",
    desc: "Input your tasks, habits, and constraints. Set priorities, deadlines, and energy requirements. Foundation poured.",
    elevation: "+0.000",
    level: "GL",
  },
  {
    phase: "02",
    title: "STRUCTURE",
    subtitle: "Sync",
    desc: "Connect Google Calendar. Existing events become immovable anchors in the scheduling grid. Structural framework rises.",
    elevation: "+3.500",
    level: "L1",
  },
  {
    phase: "03",
    title: "ENCLOSURE",
    subtitle: "Generate",
    desc: "The engine produces your optimized schedule, syncs across devices, and begins tracking. Weathertight enclosure achieved.",
    elevation: "+7.000",
    level: "L2",
  },
  {
    phase: "04",
    title: "FIT-OUT",
    subtitle: "Execute",
    desc: "Review dashboards, refine triggers, let the algorithm learn your patterns. Practical completion reached.",
    elevation: "+10.500",
    level: "L3",
  },
];

const PRICING_PLANS = [
  {
    ref: "MAT-01",
    name: "Basic",
    price: "\u20AC5",
    period: "/mo",
    highlight: false,
    specs: [
      { key: "Tasks", value: "50" },
      { key: "Habits", value: "5" },
      { key: "Runs/month", value: "100" },
      { key: "Calendar Sync", value: "YES" },
      { key: "Rescheduling", value: "\u2014" },
      { key: "Priority Support", value: "\u2014" },
      { key: "Analytics", value: "\u2014" },
      { key: "Horizon", value: "30 days" },
      { key: "Dedicated Support", value: "\u2014" },
    ],
  },
  {
    ref: "MAT-02",
    name: "Pro",
    price: "\u20AC8",
    period: "/mo",
    highlight: true,
    specs: [
      { key: "Tasks", value: "200" },
      { key: "Habits", value: "20" },
      { key: "Runs/month", value: "500" },
      { key: "Calendar Sync", value: "YES" },
      { key: "Rescheduling", value: "YES" },
      { key: "Priority Support", value: "YES" },
      { key: "Analytics", value: "\u2014" },
      { key: "Horizon", value: "45 days" },
      { key: "Dedicated Support", value: "\u2014" },
    ],
  },
  {
    ref: "MAT-03",
    name: "Premium",
    price: "\u20AC16",
    period: "/mo",
    highlight: false,
    specs: [
      { key: "Tasks", value: "\u221E" },
      { key: "Habits", value: "\u221E" },
      { key: "Runs/month", value: "\u221E" },
      { key: "Calendar Sync", value: "YES" },
      { key: "Rescheduling", value: "YES" },
      { key: "Priority Support", value: "YES" },
      { key: "Analytics", value: "YES" },
      { key: "Horizon", value: "75 days" },
      { key: "Dedicated Support", value: "YES" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Page23() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={`${cutiveMono.variable} ${libreFranklin.variable}`}
      style={{
        minHeight: "100vh",
        background: PAPER,
        color: BLACK,
        fontFamily: "var(--font-libre), sans-serif",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style jsx global>{`
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        html {
          scroll-behavior: smooth;
        }
        body {
          background: ${PAPER};
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        ::selection {
          background: ${VERMILLION};
          color: ${WHITE};
        }
        .arch-grid-bg {
          background-image:
            linear-gradient(${GRID_LINE} 0.3px, transparent 0.3px),
            linear-gradient(90deg, ${GRID_LINE} 0.3px, transparent 0.3px);
          background-size: 40px 40px;
        }
        .arch-table th,
        .arch-table td {
          border: 0.75px solid ${BLACK};
          padding: 8px 12px;
          text-align: left;
          font-size: 11px;
          font-family: var(--font-cutive), monospace;
        }
        .arch-table th {
          background: ${BLACK};
          color: ${WHITE};
          font-weight: 400;
          letter-spacing: 1px;
          text-transform: uppercase;
          font-size: 9px;
        }
        .arch-table {
          border-collapse: collapse;
          width: 100%;
        }
        .arch-table tr:hover td {
          background: rgba(26,26,26,0.02);
        }
        .booktabs-table {
          border-collapse: collapse;
          width: 100%;
        }
        .booktabs-table th {
          font-family: var(--font-cutive), monospace;
          font-size: 9px;
          font-weight: 400;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: ${BLACK};
          padding: 10px 16px;
          text-align: left;
          border-top: 2px solid ${BLACK};
          border-bottom: 1px solid ${BLACK};
        }
        .booktabs-table td {
          font-family: var(--font-cutive), monospace;
          font-size: 11px;
          color: ${BLACK};
          padding: 10px 16px;
          border-bottom: 0.5px solid ${LIGHT};
          text-align: left;
        }
        .booktabs-table tbody tr:last-child td {
          border-bottom: 2px solid ${BLACK};
        }
        .booktabs-table tr:hover td {
          background: rgba(26,26,26,0.015);
        }
        .booktabs-highlight td {
          outline: 2px solid ${VERMILLION};
          outline-offset: -2px;
        }
        @keyframes drawLine {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes revealClip {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0 0 0); }
        }
        .arch-cta-btn {
          background: ${BLACK};
          color: ${WHITE};
          border: none;
          padding: 14px 40px;
          font-family: var(--font-cutive), monospace;
          font-size: 13px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          position: relative;
          transition: all 0.2s linear;
        }
        .arch-cta-btn:hover {
          background: ${VERMILLION};
        }
        .arch-cta-btn-outline {
          background: transparent;
          color: ${BLACK};
          border: 1.5px solid ${BLACK};
          padding: 14px 40px;
          font-family: var(--font-cutive), monospace;
          font-size: 13px;
          letter-spacing: 2px;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s linear;
        }
        .arch-cta-btn-outline:hover {
          background: ${BLACK};
          color: ${WHITE};
        }
        .pricing-highlight-card {
          outline: 2px solid ${VERMILLION};
          outline-offset: 3px;
        }
        @media (max-width: 768px) {
          .arch-nav-links { display: none !important; }
          .arch-hero-title { font-size: 42px !important; letter-spacing: 4px !important; }
          .arch-title-block-cells { flex-direction: column !important; }
          .arch-title-block-cells > div { border-right: none !important; border-bottom: 0.75px solid ${BLACK} !important; }
          .arch-phases-grid { grid-template-columns: 1fr !important; }
          .arch-pricing-cards { grid-template-columns: 1fr !important; }
          .arch-hero-side-annotations { display: none !important; }
          .arch-section-pad { padding-left: 20px !important; padding-right: 20px !important; }
          .arch-footer-columns { grid-template-columns: 1fr !important; }
          .arch-hero-meta-row { flex-direction: column !important; gap: 16px !important; }
          .arch-pricing-table-wrap { overflow-x: auto; }
        }
        @media (max-width: 480px) {
          .arch-hero-title { font-size: 28px !important; letter-spacing: 2px !important; }
          .arch-table th, .arch-table td { padding: 6px 8px !important; font-size: 9px !important; }
          .booktabs-table th, .booktabs-table td { padding: 6px 8px !important; font-size: 9px !important; }
        }
      `}</style>

      <HatchPatterns />

      {/* ── CONSTRUCTION GRID BACKGROUND ── */}
      <div
        className="arch-grid-bg"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      />

      {/* ═══════════════════════════════════════════════════════════
         SECTION 1: TITLE BLOCK NAV — A1 Drawing Sheet Style
         ═══════════════════════════════════════════════════════════ */}
      <Reveal>
        <nav
          style={{
            position: "relative",
            zIndex: 10,
            margin: "16px",
            border: `1.5px solid ${BLACK}`,
            outline: `0.5px solid ${BLACK}`,
            outlineOffset: 4,
          }}
        >
          {/* Top row: project name + metadata cells */}
          <div
            className="arch-title-block-cells"
            style={{
              display: "flex",
              flexDirection: "row",
            }}
          >
            {/* Project Name Block */}
            <div
              style={{
                flex: "0 0 auto",
                padding: "12px 20px",
                borderRight: `0.75px solid ${BLACK}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-cutive)",
                  fontSize: 7,
                  letterSpacing: 2,
                  color: BLACK,
                  opacity: 0.45,
                  textTransform: "uppercase",
                }}
              >
                Project Title
              </span>
              <span
                style={{
                  fontFamily: "var(--font-libre)",
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: 2.5,
                  color: BLACK,
                  lineHeight: 1.2,
                }}
              >
                AUTO CRON
              </span>
              <span
                style={{
                  fontFamily: "var(--font-cutive)",
                  fontSize: 8,
                  color: BLACK,
                  opacity: 0.5,
                  letterSpacing: 1,
                  marginTop: 2,
                }}
              >
                SCHEDULING SYSTEM
              </span>
            </div>

            {/* Drawing Info Cells */}
            {[
              { label: "DWG NO.", value: "AC-MKTG-023" },
              { label: "REVISION", value: "R03" },
              { label: "SCALE", value: "1:100 @ A1" },
              { label: "DATE", value: "2026-02-10" },
              { label: "DRAWN BY", value: "SYSTEM" },
              { label: "CHECKED BY", value: "MM" },
            ].map((cell, i) => (
              <div
                key={`nav-cell-${cell.label}`}
                style={{
                  flex: "1 1 0",
                  padding: "8px 14px",
                  borderRight: i < 5 ? `0.5px solid ${BLACK}` : "none",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  minWidth: 80,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 7,
                    letterSpacing: 1.5,
                    color: BLACK,
                    opacity: 0.35,
                    textTransform: "uppercase",
                  }}
                >
                  {cell.label}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 11,
                    color: BLACK,
                    letterSpacing: 0.5,
                  }}
                >
                  {cell.value}
                </span>
              </div>
            ))}
          </div>

          {/* Nav Links Row — sheet references SH.1 through SH.5 */}
          <div
            className="arch-nav-links"
            style={{
              display: "flex",
              borderTop: `0.75px solid ${BLACK}`,
              background: WHITE,
            }}
          >
            {NAV_ITEMS.map((item, i) => (
              <a
                key={`nav-${item.href}`}
                href={item.href}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  textDecoration: "none",
                  fontFamily: "var(--font-cutive)",
                  fontSize: 9,
                  letterSpacing: 1.5,
                  color: BLACK,
                  textTransform: "uppercase",
                  textAlign: "center",
                  borderRight: i < NAV_ITEMS.length - 1 ? `0.5px solid ${LIGHT}` : "none",
                  transition: "background 0.15s linear, color 0.15s linear",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = BLACK;
                  (e.currentTarget as HTMLElement).style.color = WHITE;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = BLACK;
                }}
              >
                <span style={{ opacity: 0.35, marginRight: 6 }}>SH.{i + 1}</span>
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      </Reveal>

      {/* ═══════════════════════════════════════════════════════════
         SECTION 2: HERO / ELEVATION VIEW
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="hero"
        className="arch-section-pad"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "80px 40px 60px",
          minHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Reveal>
          <div style={{ textAlign: "center", position: "relative" }}>
            {/* Section cut marks flanking the view label */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 20,
                marginBottom: 20,
              }}
            >
              <SectionMarker label="A" direction="right" />
              <div
                style={{
                  flex: "0 0 auto",
                  height: 0,
                  width: 60,
                  borderTop: `1.5px dashed ${BLACK}`,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-cutive)",
                  fontSize: 9,
                  letterSpacing: 2,
                  color: BLACK,
                  opacity: 0.4,
                }}
              >
                SOUTH ELEVATION &mdash; 1:50
              </span>
              <div
                style={{
                  flex: "0 0 auto",
                  height: 0,
                  width: 60,
                  borderTop: `1.5px dashed ${BLACK}`,
                }}
              />
              <SectionMarker label="A" direction="left" />
            </div>

            {/* Title as building elevation sign */}
            <div style={{ position: "relative", display: "inline-block" }}>
              {/* Top dimension line */}
              <div style={{ marginBottom: 10 }}>
                <DimensionLine width="100%" label="28,400mm" />
              </div>

              <h1
                className="arch-hero-title"
                style={{
                  fontFamily: "var(--font-libre)",
                  fontSize: 96,
                  fontWeight: 900,
                  letterSpacing: 10,
                  lineHeight: 1,
                  color: BLACK,
                  margin: 0,
                  position: "relative",
                }}
              >
                AUTO CRON
              </h1>

              {/* Bottom dimension line */}
              <div style={{ marginTop: 10 }}>
                <DimensionLine width="100%" label="ELEVATION SIGN \u2014 PAINTED ALUMINIUM" />
              </div>

              {/* Left annotation column */}
              <div
                className="arch-hero-side-annotations"
                style={{
                  position: "absolute",
                  left: -200,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <AnnotationCallout text="TYP. LETTERFORM" leaderLength={30} direction="right" />
                <ElevationMarker level="ROOF" height="+12.600" />
                <AnnotationCallout text="FACE-FIX TO PARAPET" leaderLength={24} direction="right" color={BLACK} />
              </div>

              {/* Right annotation column */}
              <div
                className="arch-hero-side-annotations"
                style={{
                  position: "absolute",
                  right: -210,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  alignItems: "flex-start",
                }}
              >
                <AnnotationCallout
                  text="FFL +10.500"
                  leaderLength={30}
                  direction="left"
                  color={BLACK}
                />
                <ElevationMarker level="GL" height="+0.000" />
                <AnnotationCallout
                  text="SEE DWG AC-STR-004"
                  leaderLength={24}
                  direction="left"
                  color={VERMILLION}
                />
              </div>
            </div>

            {/* Subtitle as drawing note */}
            <div
              style={{
                marginTop: 44,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <polygon points="6,0 12,6 6,12 0,6" stroke={VERMILLION} strokeWidth="1" fill="none" />
                </svg>
                <span
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 8,
                    letterSpacing: 2,
                    color: VERMILLION,
                    textTransform: "uppercase",
                  }}
                >
                  General Note
                </span>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-libre)",
                  fontSize: 18,
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: BLACK,
                  maxWidth: 540,
                  textAlign: "center",
                }}
              >
                Intelligent auto-scheduling that orchestrates tasks, habits,
                <br />
                and calendar events through a priority-based algorithm.
              </p>
              <p
                style={{
                  fontFamily: "var(--font-cutive)",
                  fontSize: 9,
                  color: BLACK,
                  opacity: 0.35,
                  letterSpacing: 1,
                  marginTop: 4,
                }}
              >
                SEE SHEET 2 FOR PLAN VIEW &mdash; SEE SHEET 3 FOR STRUCTURAL DETAILS
              </p>
            </div>

            {/* Decorative row: door swings, north arrow, scale bar */}
            <div
              className="arch-hero-meta-row"
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                gap: 48,
                marginTop: 52,
              }}
            >
              <DoorSwing size={36} />
              <NorthArrow size={44} />
              <ScaleBar width={160} label="1:100" />
              <DoorSwing size={36} flip />
            </div>
          </div>
        </Reveal>
      </section>

      <SectionCutLine label="B" />

      {/* ═══════════════════════════════════════════════════════════
         SECTION 3: ROOM SCHEDULE (FEATURES)
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="features"
        className="arch-section-pad"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "40px 40px 60px",
        }}
      >
        <Reveal>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 32,
            }}
          >
            <SectionMarker label="B" direction="down" />
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-libre)",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: 3,
                  color: BLACK,
                  margin: 0,
                }}
              >
                ROOM SCHEDULE
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-cutive)",
                  fontSize: 9,
                  color: BLACK,
                  opacity: 0.4,
                  letterSpacing: 1.5,
                  marginTop: 2,
                }}
              >
                GROUND FLOOR PLAN &mdash; FUNCTIONAL SPACES
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div style={{ overflowX: "auto" }}>
            <table className="arch-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}>RM.</th>
                  <th style={{ width: 36 }}>HATCH</th>
                  <th>ROOM NAME</th>
                  <th style={{ width: 80 }}>AREA</th>
                  <th style={{ width: 80 }}>TYPE</th>
                  <th>SPECIFICATION</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f) => (
                  <tr key={f.room}>
                    <td style={{ textAlign: "center" }}>{f.room}</td>
                    <td style={{ textAlign: "center", padding: 4 }}>
                      <HatchSwatch patternId={f.material} size={22} />
                    </td>
                    <td>{f.name}</td>
                    <td>{f.area}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 6px",
                          border: `0.75px solid ${f.type === "PRIMARY" ? BLACK : LIGHT}`,
                          fontSize: 8,
                          letterSpacing: 1,
                          background: f.type === "PRIMARY" ? BLACK : "transparent",
                          color: f.type === "PRIMARY" ? WHITE : BLACK,
                        }}
                      >
                        {f.type}
                      </span>
                    </td>
                    <td style={{ fontSize: 10, opacity: 0.65, lineHeight: 1.5 }}>{f.spec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        {/* Material Legend */}
        <Reveal delay={240}>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-cutive)",
                fontSize: 8,
                letterSpacing: 1.5,
                color: BLACK,
                opacity: 0.4,
                textTransform: "uppercase",
              }}
            >
              Material Legend:
            </span>
            {[
              { id: "hatch-diagonal", name: "STEEL" },
              { id: "hatch-concrete", name: "CONCRETE" },
              { id: "hatch-glass", name: "GLASS" },
              { id: "hatch-earth", name: "EARTH" },
              { id: "hatch-insulation", name: "INSULATION" },
              { id: "hatch-metal", name: "METAL" },
            ].map((m) => (
              <div
                key={m.id}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <HatchSwatch patternId={m.id} size={16} />
                <span
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 8,
                    letterSpacing: 1,
                    color: BLACK,
                    opacity: 0.55,
                  }}
                >
                  {m.name}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <SectionCutLine label="C" />

      {/* ═══════════════════════════════════════════════════════════
         SECTION 4: CONSTRUCTION SEQUENCE (PROCESS)
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="process"
        className="arch-section-pad"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "40px 40px 60px",
        }}
      >
        <Reveal>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 32,
            }}
          >
            <SectionMarker label="C" direction="down" />
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-libre)",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: 3,
                  color: BLACK,
                  margin: 0,
                }}
              >
                CONSTRUCTION SEQUENCE
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-cutive)",
                  fontSize: 9,
                  color: BLACK,
                  opacity: 0.4,
                  letterSpacing: 1.5,
                  marginTop: 2,
                }}
              >
                PHASED DELIVERY PROGRAMME &mdash; 4 No. STAGES
              </p>
            </div>
          </div>
        </Reveal>

        <div
          className="arch-phases-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
          }}
        >
          {PHASES.map((p, i) => (
            <Reveal key={`phase-${p.phase}`} delay={i * 140}>
              <div
                style={{
                  border: `0.75px solid ${BLACK}`,
                  marginRight: i < 3 ? -0.75 : 0,
                  padding: 0,
                  position: "relative",
                }}
              >
                <CornerTicks size={10} />

                {/* Phase header bar */}
                <div
                  style={{
                    background: BLACK,
                    color: WHITE,
                    padding: "10px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-cutive)",
                      fontSize: 10,
                      letterSpacing: 2,
                    }}
                  >
                    PHASE {p.phase}
                  </span>
                  <ElevationMarker level={p.level} height={p.elevation} />
                </div>

                {/* Progressive section-cut SVG illustration */}
                <div
                  style={{
                    height: 90,
                    borderBottom: `0.5px solid ${LIGHT}`,
                    position: "relative",
                    overflow: "hidden",
                    background: WHITE,
                  }}
                >
                  <svg
                    width="100%"
                    height="90"
                    viewBox="0 0 200 90"
                    preserveAspectRatio="none"
                    style={{ display: "block" }}
                  >
                    {/* Ground line */}
                    <line x1="0" y1="78" x2="200" y2="78" stroke={BLACK} strokeWidth="1.5" />
                    {/* Hatch ground fill */}
                    <rect x="0" y="80" width="200" height="10" fill="url(#hatch-earth)" opacity="0.3" />

                    {/* Phase 1+: Foundation slab */}
                    {i >= 0 && (
                      <rect
                        x="20"
                        y="60"
                        width="160"
                        height="18"
                        fill="url(#hatch-concrete)"
                        stroke={BLACK}
                        strokeWidth="0.5"
                      />
                    )}

                    {/* Phase 2+: Structural columns + beam */}
                    {i >= 1 && (
                      <>
                        <rect x="28" y="22" width="8" height="38" fill="url(#hatch-metal)" stroke={BLACK} strokeWidth="0.5" />
                        <rect x="164" y="22" width="8" height="38" fill="url(#hatch-metal)" stroke={BLACK} strokeWidth="0.5" />
                        <rect x="28" y="18" width="144" height="4" fill={BLACK} />
                      </>
                    )}

                    {/* Phase 3+: Enclosure / glazing */}
                    {i >= 2 && (
                      <>
                        <rect x="36" y="18" width="128" height="2" fill="url(#hatch-insulation)" stroke={BLACK} strokeWidth="0.3" />
                        {/* Glass panels (double-line convention) */}
                        <line x1="50" y1="22" x2="50" y2="60" stroke={BLACK} strokeWidth="1" />
                        <line x1="52" y1="22" x2="52" y2="60" stroke={BLACK} strokeWidth="0.3" />
                        <line x1="150" y1="22" x2="150" y2="60" stroke={BLACK} strokeWidth="1" />
                        <line x1="148" y1="22" x2="148" y2="60" stroke={BLACK} strokeWidth="0.3" />
                      </>
                    )}

                    {/* Phase 4+: Fit-out / interior partitions */}
                    {i >= 3 && (
                      <>
                        <line x1="80" y1="24" x2="80" y2="60" stroke={BLACK} strokeWidth="0.75" />
                        <line x1="120" y1="24" x2="120" y2="60" stroke={BLACK} strokeWidth="0.75" />
                        {/* Door swing arc */}
                        <path d="M80,60 A20,20 0 0,1 100,55" stroke={BLACK} strokeWidth="0.4" strokeDasharray="1.5,1.5" fill="none" />
                        <line x1="80" y1="60" x2="100" y2="52" stroke={BLACK} strokeWidth="0.5" />
                        {/* Furniture indication */}
                        <rect x="60" y="38" width="12" height="12" stroke={BLACK} strokeWidth="0.3" fill="none" />
                        <rect x="130" y="38" width="12" height="12" stroke={BLACK} strokeWidth="0.3" fill="none" />
                      </>
                    )}

                    {/* Elevation label */}
                    <text x="6" y="86" fontSize="5" fontFamily="var(--font-cutive)" fill={BLACK} opacity="0.3">
                      {p.elevation}
                    </text>
                  </svg>
                </div>

                {/* Phase content */}
                <div style={{ padding: "16px" }}>
                  <h3
                    style={{
                      fontFamily: "var(--font-libre)",
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: 2,
                      color: BLACK,
                      margin: 0,
                    }}
                  >
                    {p.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "var(--font-cutive)",
                      fontSize: 9,
                      color: VERMILLION,
                      letterSpacing: 1,
                      marginTop: 4,
                      marginBottom: 12,
                    }}
                  >
                    {p.subtitle}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-libre)",
                      fontSize: 13,
                      lineHeight: 1.65,
                      color: BLACK,
                      opacity: 0.65,
                      margin: 0,
                    }}
                  >
                    {p.desc}
                  </p>
                </div>

                {/* Ref callout */}
                <div
                  style={{
                    borderTop: `0.5px solid ${LIGHT}`,
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <circle cx="4" cy="4" r="3" stroke={BLACK} strokeWidth="0.5" fill="none" />
                    <circle cx="4" cy="4" r="1" fill={BLACK} />
                  </svg>
                  <span
                    style={{
                      fontFamily: "var(--font-cutive)",
                      fontSize: 8,
                      color: BLACK,
                      opacity: 0.4,
                      letterSpacing: 1,
                    }}
                  >
                    REF: AC-SEQ-{p.phase}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Dimension chain */}
        <Reveal delay={600}>
          <div style={{ marginTop: 20 }}>
            <DimensionLine width="100%" label="TOTAL PROGRAMME DURATION: 4 WEEKS" />
          </div>
        </Reveal>

        {/* Section reference between phases */}
        <Reveal delay={700}>
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              gap: 16,
              justifyContent: "center",
            }}
          >
            {["C1", "C2", "C3", "C4"].map((ref, i) => (
              <React.Fragment key={ref}>
                <SectionMarker label={ref} direction="right" color={i === 3 ? VERMILLION : BLACK} />
                {i < 3 && (
                  <div style={{ width: 40, height: 0, borderTop: `1px dashed ${LIGHT}` }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </Reveal>
      </section>

      <SectionCutLine label="D" />

      {/* ═══════════════════════════════════════════════════════════
         SECTION 5: MATERIAL SCHEDULE (PRICING)
         Booktabs style: horizontal rules only, no vertical
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="pricing"
        className="arch-section-pad"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "40px 40px 60px",
        }}
      >
        <Reveal>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 32,
            }}
          >
            <SectionMarker label="D" direction="down" />
            <div>
              <h2
                style={{
                  fontFamily: "var(--font-libre)",
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: 3,
                  color: BLACK,
                  margin: 0,
                }}
              >
                MATERIAL SCHEDULE
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-cutive)",
                  fontSize: 9,
                  color: BLACK,
                  opacity: 0.4,
                  letterSpacing: 1.5,
                  marginTop: 2,
                }}
              >
                SPECIFICATION &amp; PRICING &mdash; 3 No. TIERS
              </p>
            </div>
          </div>
        </Reveal>

        {/* Booktabs-style table */}
        <Reveal delay={120}>
          <div className="arch-pricing-table-wrap" style={{ overflowX: "auto" }}>
            <table className="booktabs-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>REF.</th>
                  <th style={{ width: 110 }}>MATERIAL</th>
                  <th style={{ width: 90 }}>UNIT RATE</th>
                  <th>TASKS</th>
                  <th>HABITS</th>
                  <th>RUNS/MO</th>
                  <th>CAL SYNC</th>
                  <th>RESCHED.</th>
                  <th>PRIORITY</th>
                  <th>ANALYTICS</th>
                  <th>HORIZON</th>
                  <th>DEDICATED</th>
                </tr>
              </thead>
              <tbody>
                {PRICING_PLANS.map((plan) => (
                  <tr key={plan.ref} className={plan.highlight ? "booktabs-highlight" : ""}>
                    <td>{plan.ref}</td>
                    <td>
                      {plan.name.toUpperCase()}
                      {plan.highlight && (
                        <span
                          style={{
                            display: "inline-block",
                            marginLeft: 6,
                            padding: "1px 5px",
                            background: VERMILLION,
                            color: WHITE,
                            fontSize: 7,
                            letterSpacing: 1,
                            verticalAlign: "super",
                          }}
                        >
                          REC.
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 14 }}>
                      {plan.price}
                      <span style={{ fontSize: 9, opacity: 0.45 }}>{plan.period}</span>
                    </td>
                    {plan.specs.map((s, si) => (
                      <td
                        key={`${plan.ref}-${si}`}
                        style={{
                          textAlign: "center",
                          color: s.value === "\u2014" ? LIGHT : BLACK,
                        }}
                      >
                        {s.value === "YES" ? (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            style={{ display: "inline-block", verticalAlign: "middle" }}
                          >
                            <circle cx="6" cy="6" r="5" stroke={BLACK} strokeWidth="0.75" fill="none" />
                            <path d="M3,6 L5,8 L9,4" stroke={BLACK} strokeWidth="1" fill="none" />
                          </svg>
                        ) : s.value === "\u221E" ? (
                          <span style={{ fontSize: 16, fontWeight: 300 }}>{s.value}</span>
                        ) : (
                          s.value
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        {/* Pricing cards — alternate view */}
        <Reveal delay={240}>
          <div
            className="arch-pricing-cards"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0,
              marginTop: 36,
            }}
          >
            {PRICING_PLANS.map((plan, i) => (
              <div
                key={`card-${plan.ref}`}
                className={plan.highlight ? "pricing-highlight-card" : ""}
                style={{
                  border: `${plan.highlight ? 1.5 : 0.75}px solid ${BLACK}`,
                  marginRight: i < 2 ? -0.75 : 0,
                  position: "relative",
                }}
              >
                <CornerTicks size={8} />

                {/* Header */}
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: `0.75px solid ${BLACK}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontFamily: "var(--font-cutive)",
                        fontSize: 8,
                        letterSpacing: 1.5,
                        color: BLACK,
                        opacity: 0.35,
                      }}
                    >
                      {plan.ref}
                    </span>
                    <h3
                      style={{
                        fontFamily: "var(--font-libre)",
                        fontSize: 20,
                        fontWeight: 700,
                        letterSpacing: 2,
                        color: BLACK,
                        margin: 0,
                      }}
                    >
                      {plan.name.toUpperCase()}
                    </h3>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-libre)",
                        fontSize: 32,
                        fontWeight: 800,
                        color: BLACK,
                        lineHeight: 1,
                      }}
                    >
                      {plan.price}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-cutive)",
                        fontSize: 10,
                        color: BLACK,
                        opacity: 0.4,
                      }}
                    >
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Specs list */}
                <div style={{ padding: "16px 20px" }}>
                  {plan.specs.map((s, si) => (
                    <div
                      key={`${plan.ref}-spec-${si}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 0",
                        borderBottom: si < plan.specs.length - 1 ? `0.3px solid ${FAINT}` : "none",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-cutive)",
                          fontSize: 9,
                          color: BLACK,
                          opacity: 0.5,
                          letterSpacing: 0.5,
                        }}
                      >
                        {s.key}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-cutive)",
                          fontSize: 11,
                          color: s.value === "\u2014" ? LIGHT : BLACK,
                          fontWeight: s.value === "\u2014" ? 400 : 400,
                        }}
                      >
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div style={{ padding: "0 20px 20px" }}>
                  <button
                    className={plan.highlight ? "arch-cta-btn" : "arch-cta-btn-outline"}
                    style={{ width: "100%", fontSize: 10 }}
                  >
                    SELECT {plan.name.toUpperCase()}
                  </button>
                </div>

                {/* Recommended badge */}
                {plan.highlight && (
                  <div
                    style={{
                      position: "absolute",
                      top: -11,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: VERMILLION,
                      color: WHITE,
                      fontFamily: "var(--font-cutive)",
                      fontSize: 8,
                      letterSpacing: 2,
                      padding: "3px 12px",
                      textTransform: "uppercase",
                    }}
                  >
                    RECOMMENDED
                  </div>
                )}
              </div>
            ))}
          </div>
        </Reveal>

        {/* Notes */}
        <Reveal delay={360}>
          <div
            style={{
              marginTop: 24,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <AnnotationCallout text="ALL RATES EXCL. VAT. SEE SPEC ADDENDUM FOR FULL T&Cs." color={BLACK} />
          </div>
        </Reveal>
      </section>

      <SectionCutLine label="E" />

      {/* ═══════════════════════════════════════════════════════════
         SECTION 6: CTA — "Begin Construction"
         ═══════════════════════════════════════════════════════════ */}
      <section
        id="cta"
        className="arch-section-pad"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "60px 40px 80px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Reveal>
          <div style={{ textAlign: "center", position: "relative" }}>
            {/* Section marker */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 28,
              }}
            >
              <SectionMarker label="E" direction="down" color={VERMILLION} />
            </div>

            <h2
              style={{
                fontFamily: "var(--font-libre)",
                fontSize: 40,
                fontWeight: 900,
                letterSpacing: 5,
                color: BLACK,
                margin: 0,
              }}
            >
              BEGIN CONSTRUCTION
            </h2>
            <p
              style={{
                fontFamily: "var(--font-cutive)",
                fontSize: 11,
                color: BLACK,
                opacity: 0.5,
                letterSpacing: 1,
                marginTop: 14,
                maxWidth: 420,
                margin: "14px auto 0",
                lineHeight: 1.7,
              }}
            >
              Commencement notice issued. All preliminary works complete.
              Proceed to site establishment.
            </p>

            <div
              style={{
                marginTop: 36,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
              }}
            >
              {/* Annotation callout pointing to button */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <AnnotationCallout text="14-DAY FREE TRIAL" leaderLength={20} direction="right" color={VERMILLION} />
              </div>

              <button className="arch-cta-btn" style={{ fontSize: 14, padding: "16px 56px" }}>
                START FREE TRIAL
              </button>

              <ScaleBar width={200} label="1:100" />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginTop: 4,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <AnnotationCallout
                  text="NO CREDIT CARD REQUIRED"
                  leaderLength={20}
                  direction="right"
                  color={BLACK}
                />
                <span
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 9,
                    color: BLACK,
                    opacity: 0.25,
                    letterSpacing: 1,
                  }}
                >
                  |
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 9,
                    color: BLACK,
                    opacity: 0.45,
                    letterSpacing: 1,
                  }}
                >
                  FULL ACCESS &mdash; ALL FEATURES
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════════════════════════════════════════════════════════
         SECTION 7: FOOTER — Drawing notes, revision cloud, stamp
         ═══════════════════════════════════════════════════════════ */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          margin: "0 16px 80px",
          border: `1.5px solid ${BLACK}`,
          outline: `0.5px solid ${BLACK}`,
          outlineOffset: 4,
        }}
      >
        <Reveal>
          {/* Footer header bar */}
          <div
            style={{
              background: BLACK,
              color: WHITE,
              padding: "10px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-cutive)",
                fontSize: 9,
                letterSpacing: 2,
              }}
            >
              GENERAL NOTES &amp; REVISIONS
            </span>
            <span
              style={{
                fontFamily: "var(--font-cutive)",
                fontSize: 9,
                letterSpacing: 2,
              }}
            >
              SHEET 1 OF 1
            </span>
          </div>

          <div
            className="arch-footer-columns"
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr",
              gap: 0,
            }}
          >
            {/* Drawing Notes */}
            <div
              style={{
                padding: "20px",
                borderRight: `0.5px solid ${LIGHT}`,
              }}
            >
              <h4
                style={{
                  fontFamily: "var(--font-cutive)",
                  fontSize: 9,
                  letterSpacing: 2,
                  color: BLACK,
                  opacity: 0.4,
                  marginBottom: 12,
                  fontWeight: 400,
                }}
              >
                DRAWING NOTES
              </h4>
              {[
                "1. All dimensions in millimeters unless noted otherwise.",
                "2. Do not scale from this drawing. Use figured dimensions only.",
                "3. All work to comply with current building regulations.",
                "4. Contractor to verify all dimensions on site before commencing.",
                "5. This drawing is copyright \u00A9 2026 Auto Cron Systems Ltd.",
                "6. Read in conjunction with structural and services drawings.",
              ].map((note, i) => (
                <p
                  key={`note-${i}`}
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 9,
                    color: BLACK,
                    opacity: 0.5,
                    lineHeight: 1.9,
                    margin: 0,
                  }}
                >
                  {note}
                </p>
              ))}
            </div>

            {/* Revision Cloud */}
            <div
              style={{
                padding: "20px",
                borderRight: `0.5px solid ${LIGHT}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <RevisionCloud width={220} height={130}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { rev: "REV 03", date: "2026-02-10", note: "Updated pricing schedule." },
                    { rev: "REV 02", date: "2026-01-28", note: "Added room schedule detail." },
                    { rev: "REV 01", date: "2026-01-15", note: "Initial issue for comment." },
                  ].map((r) => (
                    <div key={r.rev}>
                      <span
                        style={{
                          fontFamily: "var(--font-cutive)",
                          fontSize: 8,
                          letterSpacing: 1.5,
                          color: VERMILLION,
                          display: "block",
                        }}
                      >
                        {r.rev} &mdash; {r.date}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-cutive)",
                          fontSize: 9,
                          color: BLACK,
                          opacity: 0.55,
                        }}
                      >
                        {r.note}
                      </span>
                    </div>
                  ))}
                </div>
              </RevisionCloud>
            </div>

            {/* Architect's Circular Stamp / Seal */}
            <div
              style={{
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="46" stroke={BLACK} strokeWidth="1.5" />
                <circle cx="50" cy="50" r="40" stroke={BLACK} strokeWidth="0.5" />
                <text
                  x="50"
                  y="34"
                  textAnchor="middle"
                  fontSize="7"
                  fontFamily="var(--font-cutive)"
                  fill={BLACK}
                  letterSpacing="2"
                >
                  CERTIFIED
                </text>
                <text
                  x="50"
                  y="48"
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="var(--font-libre)"
                  fill={BLACK}
                  fontWeight="700"
                  letterSpacing="1"
                >
                  AUTO CRON
                </text>
                <text
                  x="50"
                  y="60"
                  textAnchor="middle"
                  fontSize="6"
                  fontFamily="var(--font-cutive)"
                  fill={BLACK}
                  letterSpacing="1"
                >
                  SYSTEMS LTD.
                </text>
                <line x1="25" y1="66" x2="75" y2="66" stroke={BLACK} strokeWidth="0.5" />
                <text
                  x="50"
                  y="76"
                  textAnchor="middle"
                  fontSize="6"
                  fontFamily="var(--font-cutive)"
                  fill={BLACK}
                  letterSpacing="1"
                  opacity="0.5"
                >
                  REG. No. AC-2026
                </text>
                {/* Small north arrow at bottom of seal */}
                <line x1="50" y1="95" x2="50" y2="85" stroke={BLACK} strokeWidth="0.5" />
                <polygon points="50,85 48,89 52,89" fill={BLACK} />
              </svg>

              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 8,
                    color: BLACK,
                    opacity: 0.4,
                    letterSpacing: 1,
                    margin: 0,
                  }}
                >
                  APPROVED FOR CONSTRUCTION
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 8,
                    color: BLACK,
                    opacity: 0.3,
                    letterSpacing: 1,
                    margin: "4px 0 0",
                  }}
                >
                  2026-02-10
                </p>
              </div>
            </div>
          </div>

          {/* Footer bottom utility bar */}
          <div
            style={{
              borderTop: `0.75px solid ${BLACK}`,
              padding: "8px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {["Terms", "Privacy", "Documentation", "Support"].map((link) => (
                <a
                  key={link}
                  href="#"
                  style={{
                    fontFamily: "var(--font-cutive)",
                    fontSize: 9,
                    color: BLACK,
                    opacity: 0.4,
                    textDecoration: "none",
                    letterSpacing: 1,
                    transition: "opacity 0.15s linear",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.opacity = "0.4";
                  }}
                >
                  {link.toUpperCase()}
                </a>
              ))}
            </div>
            <span
              style={{
                fontFamily: "var(--font-cutive)",
                fontSize: 8,
                color: BLACK,
                opacity: 0.3,
                letterSpacing: 1,
              }}
            >
              &copy; 2026 AUTO CRON SYSTEMS LTD. ALL RIGHTS RESERVED.
            </span>
          </div>
        </Reveal>
      </footer>

      {/* ─── Design Switcher ─── */}
      <DesignSwitcher />
    </div>
  );
}
