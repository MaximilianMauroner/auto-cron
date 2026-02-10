"use client";

import { useEffect, useRef, useCallback } from "react";
import { Bebas_Neue, Outfit, Cutive_Mono } from "next/font/google";
import { DesignSwitcher } from "./design-switcher";

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const cutiveMono = Cutive_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-cutive",
  display: "swap",
});

const NAVY = "#14213D";
const PARCHMENT = "#F7F3ED";
const GOLD = "#FCA311";
const WARM = "#D4CCC0";

const FEATURES = [
  {
    num: "01",
    name: "Priority Algorithm",
    desc: "Every task carries a weight. Deadlines, energy cost, dependencies\u2009\u2014\u2009the algorithm considers all dimensions and produces a schedule that respects what matters most to you.",
  },
  {
    num: "02",
    name: "Google Calendar Sync",
    desc: "Bi-directional synchronization with Google Calendar. Your events flow in, your scheduled blocks flow out. One unified timeline. Zero\u00A0friction.",
  },
  {
    num: "03",
    name: "Habit Orchestration",
    desc: "Habits are not tasks\u2009\u2014\u2009they require rhythm. Auto\u00A0Cron finds recurring windows that respect your energy patterns and protects them from scheduling conflicts.",
  },
  {
    num: "04",
    name: "Smart Rescheduling",
    desc: "When life disrupts your plan, the algorithm adapts. Missed blocks cascade forward intelligently, preserving priority order and deadline constraints.",
  },
  {
    num: "05",
    name: "Time Horizon Planning",
    desc: "Plan up to 75\u00A0days ahead. The scheduling engine distributes work across your horizon, preventing deadline clustering and last-minute overload.",
  },
  {
    num: "06",
    name: "Analytics Dashboard",
    desc: "Completion rates, scheduling efficiency, habit streaks, peak productivity windows\u2009\u2014\u2009data-driven insight into how you actually spend your time.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Define",
    text: "Input your tasks, habits, and constraints. Set priorities, deadlines, and energy requirements.",
  },
  {
    num: "02",
    title: "Sync",
    text: "Connect Google Calendar. Existing events become immovable anchors in the scheduling grid.",
  },
  {
    num: "03",
    title: "Generate",
    text: "The algorithm runs. Hundreds of permutations tested. The optimal schedule surfaces in seconds.",
  },
  {
    num: "04",
    title: "Execute",
    text: "Your schedule deploys to your calendar. Work the plan. When things shift, Auto\u00A0Cron re-optimizes.",
  },
];

const PLANS = [
  {
    name: "Basic",
    price: "5",
    features: [
      "50 tasks",
      "5 habits",
      "100 scheduling runs",
      "Google Calendar sync",
    ],
    highlight: false,
  },
  {
    name: "Pro",
    price: "8",
    features: [
      "200 tasks",
      "20 habits",
      "500 scheduling runs",
      "Smart rescheduling",
      "Priority support",
    ],
    highlight: true,
  },
  {
    name: "Premium",
    price: "16",
    features: [
      "Unlimited everything",
      "Analytics dashboard",
      "75-day horizon",
      "Dedicated support",
    ],
    highlight: false,
  },
];

/* Schedule blocks for hero viz: [col, startRow, spanRows] */
const SCHEDULE_BLOCKS: [number, number, number][] = [
  [0, 1, 2],
  [1, 4, 3],
  [2, 2, 2],
  [2, 7, 2],
  [3, 0, 2],
  [3, 5, 3],
  [4, 3, 2],
  [4, 8, 2],
];

interface LandingPageProps {
  showDesignSwitcher?: boolean;
  logoHref?: string;
}

export function LandingPage({
  showDesignSwitcher = false,
  logoHref = "/",
}: LandingPageProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const heroWatermarkRef = useRef<HTMLDivElement>(null);

  const revealCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add("revealed");
        }
      }
    },
    []
  );

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    observerRef.current = new IntersectionObserver(revealCallback, {
      threshold: 0.08,
      rootMargin: "0px 0px -40px 0px",
    });

    const elements = document.querySelectorAll("[data-reveal]");
    for (const el of elements) {
      if (prefersReduced) {
        (el as HTMLElement).classList.add("revealed");
      } else {
        observerRef.current.observe(el);
      }
    }

    if (prefersReduced) return () => observerRef.current?.disconnect();

    const handleMouseMove = (e: MouseEvent) => {
      if (spotlightRef.current) {
        spotlightRef.current.style.left = `${e.clientX - 300}px`;
        spotlightRef.current.style.top = `${e.clientY - 300}px`;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);

    const handleScroll = () => {
      if (heroWatermarkRef.current) {
        heroWatermarkRef.current.style.transform = `translateY(${window.scrollY * 0.12}px)`;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [revealCallback]);

  return (
    <div
      className={`${bebasNeue.variable} ${outfit.variable} ${cutiveMono.variable}`}
    >
      {/* ── SVG GRAIN ── */}
      <svg
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9998,
          opacity: 0.032,
        }}
        aria-hidden="true"
      >
        <filter id="grain-f">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-f)" />
      </svg>

      <style jsx global>{`
        *,
        *::before,
        *::after {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html {
          scroll-behavior: smooth;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          color-scheme: light;
        }
        body {
          background: ${PARCHMENT};
          color: ${NAVY};
          font-family: var(--font-outfit), "Helvetica Neue", Helvetica,
            sans-serif;
          font-weight: 400;
          font-size: 16px;
          line-height: 1.65;
          overflow-x: hidden;
        }
        .mono {
          font-family: var(--font-cutive), "Courier New", monospace;
          font-weight: 400;
        }
        .display {
          font-family: var(--font-bebas), Impact, sans-serif;
          font-weight: 400;
        }

        /* ── CURSOR ── */
        .swiss-page {
          cursor: crosshair;
        }
        .swiss-page a,
        .swiss-page button {
          cursor: pointer;
        }

        /* ── FOCUS ── */
        :focus-visible {
          outline: 2px solid ${GOLD};
          outline-offset: 3px;
        }

        /* ── SPOTLIGHT ── */
        .spotlight {
          position: fixed;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(252, 163, 17, 0.045),
            transparent 70%
          );
          pointer-events: none;
          z-index: 2;
          transition: left 0.5s cubic-bezier(0.22, 1, 0.36, 1),
            top 0.5s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: left, top;
        }

        /* ── GRID OVERLAY ── */
        .swiss-page::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background: repeating-linear-gradient(
            to right,
            transparent 0,
            transparent calc(100% / 12 - 1px),
            rgba(20, 33, 61, 0.025) calc(100% / 12 - 1px),
            rgba(20, 33, 61, 0.025) calc(100% / 12)
          );
        }
        .swiss-page {
          position: relative;
          z-index: 1;
          padding-bottom: 56px;
        }

        /* ── WRAPPERS & RULES ── */
        .s-wrap {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 clamp(24px, 5vw, 80px);
          position: relative;
          z-index: 1;
        }
        .rule-thick {
          border: none;
          height: 2px;
          background: ${NAVY};
          width: 100%;
          margin: 0;
        }

        /* ── REGISTRATION MARKS ── */
        .reg-mark {
          position: relative;
        }
        .reg-mark::before,
        .reg-mark::after {
          content: "+";
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          font-family: var(--font-cutive), monospace;
          font-size: 9px;
          color: ${GOLD};
          opacity: 0.4;
          line-height: 1;
        }
        .reg-mark::before {
          left: -20px;
        }
        .reg-mark::after {
          right: -20px;
        }

        /* ── ROTATED LABEL ── */
        .rotated-label {
          position: absolute;
          font-family: var(--font-cutive), monospace;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          transform: rotate(-90deg);
          transform-origin: left top;
          white-space: nowrap;
          color: ${NAVY};
          opacity: 0.3;
        }

        /* ── ACCENT ── */
        .gold {
          color: ${GOLD};
        }

        /* ── HEADINGS ── */
        h1,
        h2,
        h3 {
          text-wrap: balance;
        }

        /* ── BUTTON PRIMARY ── */
        .btn-gold {
          display: inline-block;
          position: relative;
          overflow: hidden;
          background: ${GOLD};
          color: ${NAVY};
          font-family: var(--font-outfit), sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 16px 48px;
          border: none;
          text-decoration: none;
          z-index: 1;
          transition: color 0.4s ease;
          touch-action: manipulation;
        }
        .btn-gold::before {
          content: "";
          position: absolute;
          inset: 0;
          background: ${NAVY};
          transform: translateX(-101%);
          transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
          z-index: -1;
        }
        .btn-gold:hover {
          color: ${PARCHMENT};
        }
        .btn-gold:hover::before {
          transform: translateX(0);
        }

        /* ── BUTTON OUTLINE ── */
        .btn-outline {
          display: inline-block;
          position: relative;
          overflow: hidden;
          background: transparent;
          color: ${NAVY};
          font-family: var(--font-outfit), sans-serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 15px 40px;
          border: 2px solid ${NAVY};
          text-decoration: none;
          z-index: 1;
          transition: color 0.4s ease, border-color 0.4s ease;
          touch-action: manipulation;
        }
        .btn-outline:hover {
          color: ${GOLD};
          border-color: ${GOLD};
        }

        /* ── NAV LINK ── */
        .nav-link {
          font-family: var(--font-cutive), monospace;
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          text-decoration: none;
          color: ${NAVY};
          position: relative;
          transition: color 0.25s ease;
          touch-action: manipulation;
        }
        .nav-link::after {
          content: "";
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 1px;
          background: ${GOLD};
          transition: width 0.35s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .nav-link:hover {
          color: ${GOLD};
        }
        .nav-link:hover::after {
          width: 100%;
        }

        /* ── SELECTION ── */
        ::selection {
          background: ${GOLD};
          color: ${NAVY};
        }

        /* ── KEYFRAMES ── */
        @keyframes clipUp {
          from {
            clip-path: inset(100% 0 0 0);
            transform: translateY(40px);
          }
          to {
            clip-path: inset(0 0 0 0);
            transform: translateY(0);
          }
        }
        @keyframes lineExpand {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(32px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes gridPulse {
          0%,
          100% {
            opacity: 0.12;
          }
          50% {
            opacity: 0.2;
          }
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes glowPulse {
          0%,
          100% {
            opacity: 0.2;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.45;
            transform: translate(-50%, -50%) scale(1.06);
          }
        }

        /* ── HERO ANIMATIONS ── */
        .hero-line-1 {
          animation: clipUp 1s cubic-bezier(0.19, 1, 0.22, 1) 0.2s both;
        }
        .hero-line-2 {
          animation: clipUp 1s cubic-bezier(0.19, 1, 0.22, 1) 0.4s both;
        }
        .hero-gold-rule {
          transform-origin: left;
          animation: lineExpand 1.2s cubic-bezier(0.19, 1, 0.22, 1) 0.7s both;
        }
        .hero-tagline {
          animation: fadeUp 0.9s ease 0.9s both;
        }
        .hero-cta {
          animation: fadeUp 0.9s ease 1.1s both;
        }
        .hero-nav {
          animation: fadeIn 0.6s ease 0s both;
        }
        .hero-grid-viz {
          animation: fadeIn 1.4s ease 0.6s both;
        }

        /* ── SCROLL REVEALS ── */
        [data-reveal] {
          opacity: 0;
          transform: translateY(40px);
          transition: opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1),
            transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
        }
        [data-reveal].revealed {
          opacity: 1;
          transform: translateY(0);
        }

        /* ── FEATURE ROW ── */
        .feat-row {
          position: relative;
          transition: background 0.5s ease,
            padding-left 0.5s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .feat-row::after {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: ${GOLD};
          transform: scaleY(0);
          transform-origin: top;
          transition: transform 0.5s cubic-bezier(0.19, 1, 0.22, 1);
        }
        .feat-row:hover::after {
          transform: scaleY(1);
        }
        .feat-row:hover {
          background: linear-gradient(
            90deg,
            rgba(252, 163, 17, 0.06),
            transparent 60%
          );
          padding-left: 20px !important;
        }
        .feat-row:hover .feat-num {
          color: ${GOLD} !important;
          opacity: 0.6 !important;
        }
        .feat-row:hover .feat-name {
          color: ${GOLD};
        }

        /* ── PROCESS STEP ── */
        .proc-step {
          transition: background 0.4s ease, transform 0.4s ease;
        }
        .proc-step:hover {
          background: rgba(252, 163, 17, 0.04);
          transform: translateY(-2px);
        }
        .proc-step:hover .proc-node {
          background: ${GOLD} !important;
          border-color: ${GOLD} !important;
        }
        .proc-step:hover .proc-node-dot {
          background: ${NAVY} !important;
        }

        /* ── PRICING CARD ── */
        .pricing-card {
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 0.4s ease;
        }
        .pricing-card:hover {
          transform: translateY(-4px);
        }
        .pricing-card-pro {
          transform: translateY(-8px);
          box-shadow: 0 20px 60px rgba(252, 163, 17, 0.15),
            0 4px 16px rgba(20, 33, 61, 0.08);
        }
        .pricing-card-pro:hover {
          transform: translateY(-12px);
          box-shadow: 0 28px 80px rgba(252, 163, 17, 0.2),
            0 8px 24px rgba(20, 33, 61, 0.1);
        }

        /* ── PRICING LINK ── */
        .pricing-link {
          display: inline-block;
          font-family: var(--font-outfit), sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-decoration: none;
          color: ${NAVY};
          padding: 14px 0;
          border-bottom: 2px solid ${NAVY};
          transition: border-color 0.3s ease, color 0.3s ease;
          touch-action: manipulation;
        }
        .pricing-link:hover {
          border-color: ${GOLD};
          color: ${GOLD};
        }

        /* ── REDUCED MOTION ── */
        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
          .spotlight {
            display: none;
          }
          [data-reveal] {
            opacity: 1;
            transform: none;
          }
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .hero-grid-viz {
            display: none !important;
          }
          .hero-title {
            font-size: clamp(4.5rem, 18vw, 12rem) !important;
          }
          .manifesto-grid {
            grid-template-columns: 1fr !important;
          }
          .feature-row-inner {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .feature-num-col {
            justify-content: flex-start !important;
          }
          .process-grid {
            grid-template-columns: 1fr !important;
          }
          .proc-connector {
            display: none !important;
          }
          .process-grid .proc-step:not(:last-child) {
            border-bottom: 1px solid ${WARM} !important;
            padding-bottom: 40px !important;
          }
          .pricing-grid {
            grid-template-columns: 1fr !important;
          }
          .pricing-card-pro {
            transform: none;
          }
          .spotlight {
            display: none;
          }
          .nav-desktop {
            display: none !important;
          }
          .cta-title {
            font-size: clamp(4rem, 16vw, 12rem) !important;
          }
        }
      `}</style>

      <div className="swiss-page">
        {/* ── MOUSE SPOTLIGHT ── */}
        <div ref={spotlightRef} className="spotlight" aria-hidden="true" />

        {/* ════════════════════════════════════════════
            NAVIGATION
            ════════════════════════════════════════════ */}
        <nav
          className="hero-nav"
          aria-label="Main navigation"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            background: `${PARCHMENT}E8`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="s-wrap">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: "72px",
              }}
            >
              <a
                href={logoHref}
                aria-label="Auto Cron home"
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  fontWeight: 800,
                  fontSize: "18px",
                  letterSpacing: "0.08em",
                  textDecoration: "none",
                  color: NAVY,
                  textTransform: "uppercase",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    background: GOLD,
                    borderRadius: "50%",
                    display: "inline-block",
                    boxShadow: `0 0 14px ${GOLD}80`,
                  }}
                />
                Auto&nbsp;Cron
              </a>

              <div
                className="nav-desktop"
                style={{
                  display: "flex",
                  gap: "32px",
                  alignItems: "center",
                }}
              >
                {["Features", "Process", "Pricing"].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className="nav-link"
                  >
                    {item}
                  </a>
                ))}
                <a
                  href="#cta"
                  className="btn-gold"
                  style={{ padding: "10px 28px", fontSize: "11px" }}
                >
                  Get Started
                </a>
              </div>
            </div>
          </div>
          <hr className="rule-thick" />
        </nav>

        {/* ════════════════════════════════════════════
            HERO
            ════════════════════════════════════════════ */}
        <section
          style={{
            position: "relative",
            padding: "clamp(80px, 14vh, 200px) 0 clamp(60px, 10vh, 140px)",
            overflow: "hidden",
          }}
        >
          <div
            className="rotated-label"
            style={{ left: "clamp(12px, 2vw, 40px)", top: "200px" }}
            aria-hidden="true"
          >
            Since 2025
          </div>

          {/* Parallax watermark */}
          <div
            ref={heroWatermarkRef}
            aria-hidden="true"
            style={{
              position: "absolute",
              right: "-3%",
              top: "-10%",
              fontFamily: "var(--font-bebas), Impact, sans-serif",
              fontSize: "clamp(24rem, 50vw, 60rem)",
              lineHeight: 0.8,
              opacity: 0.025,
              color: NAVY,
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 0,
              willChange: "transform",
            }}
          >
            AC
          </div>

          <div className="s-wrap" style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "clamp(32px, 4vw, 80px)",
                alignItems: "center",
              }}
            >
              {/* Left: Content */}
              <div>
                <h1
                  className="hero-title display"
                  style={{
                    fontSize: "clamp(7rem, 17vw, 18rem)",
                    lineHeight: 0.9,
                    letterSpacing: "-0.01em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  <span className="hero-line-1" style={{ display: "block" }}>
                    Auto
                  </span>
                  <span className="hero-line-2" style={{ display: "block" }}>
                    Cron
                  </span>
                </h1>

                <div
                  className="hero-gold-rule"
                  aria-hidden="true"
                  style={{
                    height: "3px",
                    width: "clamp(120px, 22vw, 300px)",
                    background: `linear-gradient(90deg, ${GOLD}, ${GOLD}30)`,
                    marginTop: "clamp(24px, 3vw, 44px)",
                  }}
                />

                <div
                  className="hero-tagline"
                  style={{
                    marginTop: "clamp(24px, 3vw, 44px)",
                    maxWidth: "580px",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "var(--font-outfit), sans-serif",
                      fontSize: "clamp(1.05rem, 1.6vw, 1.25rem)",
                      lineHeight: 1.75,
                      color: NAVY,
                      opacity: 0.7,
                      fontWeight: 400,
                    }}
                  >
                    Intelligent auto-scheduling that orchestrates your tasks,
                    habits, and calendar events through a{" "}
                    <span
                      style={{
                        color: GOLD,
                        fontWeight: 700,
                        borderBottom: `2px solid ${GOLD}40`,
                      }}
                    >
                      priority-based
                    </span>{" "}
                    algorithm.
                  </p>
                </div>

                <div
                  className="hero-cta"
                  style={{
                    marginTop: "clamp(32px, 4vw, 56px)",
                    display: "flex",
                    alignItems: "center",
                    gap: "20px",
                    flexWrap: "wrap",
                  }}
                >
                  <a href="#cta" className="btn-gold">
                    Start Scheduling
                  </a>
                  <a href="#features" className="btn-outline">
                    Learn More
                  </a>
                </div>
              </div>

              {/* Right: Abstract Schedule Grid */}
              <div
                className="hero-grid-viz"
                aria-hidden="true"
                style={{
                  width: "clamp(200px, 24vw, 340px)",
                  position: "relative",
                }}
              >
                <svg
                  viewBox="0 0 280 400"
                  fill="none"
                  style={{
                    width: "100%",
                    height: "auto",
                    opacity: 0.85,
                  }}
                >
                  {/* Column lines */}
                  {Array.from({ length: 6 }, (_, i) => (
                    <line
                      key={`col-${i}`}
                      x1={i * 56}
                      y1="0"
                      x2={i * 56}
                      y2="400"
                      stroke={NAVY}
                      strokeWidth="0.5"
                      opacity="0.08"
                    />
                  ))}
                  {/* Row lines */}
                  {Array.from({ length: 13 }, (_, i) => (
                    <line
                      key={`row-${i}`}
                      x1="0"
                      y1={i * 33.3}
                      x2="280"
                      y2={i * 33.3}
                      stroke={NAVY}
                      strokeWidth="0.5"
                      opacity="0.06"
                    />
                  ))}
                  {/* Schedule blocks */}
                  {SCHEDULE_BLOCKS.map(([col, row, span], idx) => (
                    <rect
                      key={`block-${idx}`}
                      x={col * 56 + 3}
                      y={row * 33.3 + 3}
                      width={50}
                      height={span * 33.3 - 6}
                      rx="2"
                      fill={GOLD}
                      opacity={0.15 + idx * 0.06}
                      style={{
                        animation: `gridPulse ${3 + idx * 0.7}s ease-in-out ${idx * 0.3}s infinite`,
                      }}
                    />
                  ))}
                  {/* Corner markers */}
                  <line
                    x1="0"
                    y1="0"
                    x2="16"
                    y2="0"
                    stroke={GOLD}
                    strokeWidth="2"
                  />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="16"
                    stroke={GOLD}
                    strokeWidth="2"
                  />
                  <line
                    x1="280"
                    y1="0"
                    x2="264"
                    y2="0"
                    stroke={GOLD}
                    strokeWidth="2"
                  />
                  <line
                    x1="280"
                    y1="0"
                    x2="280"
                    y2="16"
                    stroke={GOLD}
                    strokeWidth="2"
                  />
                  <line
                    x1="0"
                    y1="400"
                    x2="16"
                    y2="400"
                    stroke={GOLD}
                    strokeWidth="2"
                  />
                  <line
                    x1="0"
                    y1="400"
                    x2="0"
                    y2="384"
                    stroke={GOLD}
                    strokeWidth="2"
                  />
                  <line
                    x1="280"
                    y1="400"
                    x2="264"
                    y2="400"
                    stroke={GOLD}
                    strokeWidth="2"
                  />
                  <line
                    x1="280"
                    y1="400"
                    x2="280"
                    y2="384"
                    stroke={GOLD}
                    strokeWidth="2"
                  />
                  {/* Day labels */}
                  {["M", "T", "W", "T", "F"].map((d, i) => (
                    <text
                      key={d + i}
                      x={i * 56 + 28}
                      y="395"
                      textAnchor="middle"
                      fill={NAVY}
                      opacity="0.2"
                      fontSize="9"
                      fontFamily="var(--font-cutive), monospace"
                    >
                      {d}
                    </text>
                  ))}
                </svg>
              </div>
            </div>
          </div>
        </section>

        <div className="s-wrap">
          <hr className="rule-thick reg-mark" />
        </div>

        {/* ════════════════════════════════════════════
            MANIFESTO — Section 01
            ════════════════════════════════════════════ */}
        <section
          id="manifesto"
          style={{
            padding: "clamp(80px, 10vh, 160px) 0",
            position: "relative",
          }}
        >
          <div
            className="rotated-label"
            style={{ left: "clamp(12px, 2vw, 40px)", top: "180px" }}
            aria-hidden="true"
          >
            Manifesto
          </div>

          <div className="s-wrap" data-reveal>
            <div
              className="manifesto-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: "clamp(32px, 6vw, 100px)",
                alignItems: "start",
              }}
            >
              <div>
                <span
                  className="display gold"
                  aria-hidden="true"
                  style={{
                    fontSize: "clamp(6rem, 12vw, 12rem)",
                    lineHeight: 0.85,
                    display: "block",
                    textShadow: `0 0 80px ${GOLD}20`,
                  }}
                >
                  01
                </span>
              </div>

              <div>
                {/* Decorative quote mark */}
                <div
                  aria-hidden="true"
                  style={{
                    fontFamily: "var(--font-bebas), Impact, sans-serif",
                    fontSize: "clamp(4rem, 8vw, 8rem)",
                    lineHeight: 0.5,
                    color: GOLD,
                    opacity: 0.15,
                    marginBottom: "-12px",
                    marginLeft: "-8px",
                    userSelect: "none",
                  }}
                >
                  {"\u201C"}
                </div>

                <h2
                  style={{
                    fontFamily: "var(--font-outfit), sans-serif",
                    fontSize: "clamp(1.6rem, 3.2vw, 2.8rem)",
                    fontWeight: 700,
                    lineHeight: 1.2,
                    marginBottom: "clamp(20px, 3vw, 40px)",
                    maxWidth: "620px",
                  }}
                >
                  Your calendar is not a plan.
                  <br />
                  It is a{" "}
                  <span
                    style={{
                      color: GOLD,
                      position: "relative",
                    }}
                  >
                    {"\u201C"}record{"\u201D"}
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        bottom: "-2px",
                        left: 0,
                        right: 0,
                        height: "3px",
                        background: `${GOLD}40`,
                      }}
                    />
                  </span>{" "}
                  of compromises.
                </h2>

                <div
                  style={{
                    maxWidth: "520px",
                    fontSize: "15px",
                    lineHeight: 1.85,
                    opacity: 0.65,
                    fontWeight: 400,
                  }}
                >
                  <p style={{ marginBottom: "1.2em" }}>
                    Most people schedule reactively. A meeting appears, you work
                    around it. A deadline approaches, you panic-block time. Your
                    habits drift. Your priorities dissolve into the noise of an
                    overcrowded week.
                  </p>
                  <p style={{ marginBottom: "1.2em" }}>
                    Auto&nbsp;Cron inverts this pattern. You declare what
                    matters&nbsp;&mdash; the algorithm does the rest. It reads
                    your calendar, respects your constraints, understands your
                    energy, and produces a schedule that is mathematically
                    optimized for what you actually want to accomplish.
                  </p>
                  <p>
                    This is not a to-do list. This is not another calendar app.
                    This is a scheduling engine built on the premise that your
                    time deserves the same rigor as a production deployment
                    pipeline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="s-wrap">
          <hr className="rule-thick reg-mark" />
        </div>

        {/* ════════════════════════════════════════════
            FEATURES — Section 02
            ════════════════════════════════════════════ */}
        <section
          id="features"
          style={{
            padding: "clamp(80px, 10vh, 160px) 0",
            position: "relative",
          }}
        >
          <div
            className="rotated-label"
            style={{ left: "clamp(12px, 2vw, 40px)", top: "180px" }}
            aria-hidden="true"
          >
            Features
          </div>

          <div className="s-wrap">
            <div
              data-reveal
              style={{ marginBottom: "clamp(40px, 5vw, 72px)" }}
            >
              <span
                className="display gold"
                aria-hidden="true"
                style={{
                  fontSize: "clamp(5rem, 10vw, 10rem)",
                  lineHeight: 0.85,
                  display: "block",
                  marginBottom: "12px",
                  textShadow: `0 0 60px ${GOLD}18`,
                }}
              >
                02
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  fontSize: "clamp(1.3rem, 2.2vw, 2rem)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Capabilities
              </h2>
            </div>

            {FEATURES.map((feature, idx) => (
              <div key={feature.num}>
                <hr
                  className="rule-thick"
                  style={{ opacity: idx === 0 ? 1 : 0.15 }}
                />
                <div
                  className="feat-row feature-row-inner"
                  data-reveal
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 1.4fr",
                    gap: "clamp(16px, 3vw, 48px)",
                    padding: "clamp(28px, 3.5vw, 48px) 0",
                    alignItems: "baseline",
                    transitionDelay: `${idx * 0.07}s`,
                  }}
                >
                  <div
                    className="feature-num-col"
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                    }}
                  >
                    <span
                      className="feat-num display"
                      style={{
                        fontSize: "clamp(2.2rem, 4vw, 3.8rem)",
                        lineHeight: 1,
                        opacity: 0.12,
                        transition: "color 0.4s ease, opacity 0.4s ease",
                      }}
                    >
                      {feature.num}
                    </span>
                  </div>

                  <h3
                    className="feat-name"
                    style={{
                      fontFamily: "var(--font-outfit), sans-serif",
                      fontSize: "clamp(1.05rem, 1.6vw, 1.3rem)",
                      fontWeight: 700,
                      lineHeight: 1.3,
                      letterSpacing: "0.01em",
                      transition: "color 0.4s ease",
                    }}
                  >
                    {idx === 0 && (
                      <span className="gold">
                        {feature.name.split(" ")[0]}
                      </span>
                    )}
                    {idx === 0
                      ? ` ${feature.name.split(" ").slice(1).join(" ")}`
                      : feature.name}
                  </h3>

                  <p
                    style={{
                      fontSize: "14.5px",
                      lineHeight: 1.8,
                      maxWidth: "480px",
                      opacity: 0.55,
                      fontWeight: 400,
                    }}
                  >
                    {feature.desc}
                  </p>
                </div>
                {idx === FEATURES.length - 1 && (
                  <hr className="rule-thick" style={{ opacity: 0.15 }} />
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="s-wrap">
          <hr className="rule-thick reg-mark" />
        </div>

        {/* ════════════════════════════════════════════
            PROCESS — Section 03
            ════════════════════════════════════════════ */}
        <section
          id="process"
          style={{
            padding: "clamp(80px, 10vh, 160px) 0",
            position: "relative",
          }}
        >
          <div
            className="rotated-label"
            style={{ left: "clamp(12px, 2vw, 40px)", top: "180px" }}
            aria-hidden="true"
          >
            Process
          </div>

          <div className="s-wrap">
            <div
              data-reveal
              style={{ marginBottom: "clamp(40px, 5vw, 72px)" }}
            >
              <span
                className="display gold"
                aria-hidden="true"
                style={{
                  fontSize: "clamp(5rem, 10vw, 10rem)",
                  lineHeight: 0.85,
                  display: "block",
                  marginBottom: "12px",
                  textShadow: `0 0 60px ${GOLD}18`,
                }}
              >
                03
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  fontSize: "clamp(1.3rem, 2.2vw, 2rem)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                How It Works
              </h2>
            </div>

            {/* Timeline connector line */}
            <div
              data-reveal
              style={{
                display: "grid",
                position: "relative",
              }}
            >
              {/* Horizontal connector */}
              <div
                className="proc-connector"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: "20px",
                  left: "calc(12.5%)",
                  right: "calc(12.5%)",
                  height: "1px",
                  background: `linear-gradient(90deg, ${GOLD}60, ${GOLD}, ${GOLD}, ${GOLD}60)`,
                  zIndex: 1,
                }}
              />

              <div
                className="process-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "clamp(12px, 2vw, 24px)",
                }}
              >
                {STEPS.map((step, idx) => (
                  <div
                    key={step.num}
                    className="proc-step"
                    style={{
                      position: "relative",
                      padding: "0 clamp(8px, 1vw, 20px)",
                      textAlign: "center",
                    }}
                  >
                    {/* Node dot */}
                    <div
                      className="proc-node"
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        border: `2px solid ${NAVY}`,
                        background: PARCHMENT,
                        margin: "0 auto 32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        zIndex: 2,
                        transition:
                          "background 0.4s ease, border-color 0.4s ease",
                      }}
                    >
                      <div
                        className="proc-node-dot"
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: GOLD,
                          transition: "background 0.4s ease",
                        }}
                      />
                    </div>

                    {/* Ghost number */}
                    <div
                      aria-hidden="true"
                      className="display"
                      style={{
                        fontSize: "clamp(6rem, 10vw, 10rem)",
                        lineHeight: 0.75,
                        opacity: 0.03,
                        color: NAVY,
                        pointerEvents: "none",
                        userSelect: "none",
                        marginBottom: "-40px",
                      }}
                    >
                      {step.num}
                    </div>

                    <span
                      className="mono"
                      style={{
                        fontSize: "10px",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        opacity: 0.35,
                        display: "block",
                        marginBottom: "12px",
                      }}
                    >
                      Step {step.num}
                    </span>

                    <h3
                      style={{
                        fontFamily: "var(--font-outfit), sans-serif",
                        fontSize: "clamp(1.15rem, 1.8vw, 1.5rem)",
                        fontWeight: 700,
                        lineHeight: 1.2,
                        marginBottom: "14px",
                      }}
                    >
                      {idx === 2 ? (
                        <span className="gold">{step.title}</span>
                      ) : (
                        step.title
                      )}
                    </h3>

                    <p
                      style={{
                        fontSize: "14px",
                        lineHeight: 1.75,
                        maxWidth: "260px",
                        margin: "0 auto",
                        opacity: 0.55,
                        fontWeight: 400,
                      }}
                    >
                      {step.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="s-wrap">
          <hr className="rule-thick reg-mark" />
        </div>

        {/* ════════════════════════════════════════════
            PRICING — Section 04
            ════════════════════════════════════════════ */}
        <section
          id="pricing"
          style={{
            padding: "clamp(80px, 10vh, 160px) 0",
            position: "relative",
          }}
        >
          <div
            className="rotated-label"
            style={{ left: "clamp(12px, 2vw, 40px)", top: "180px" }}
            aria-hidden="true"
          >
            Pricing
          </div>

          <div className="s-wrap">
            <div
              data-reveal
              style={{ marginBottom: "clamp(40px, 5vw, 72px)" }}
            >
              <span
                className="display gold"
                aria-hidden="true"
                style={{
                  fontSize: "clamp(5rem, 10vw, 10rem)",
                  lineHeight: 0.85,
                  display: "block",
                  marginBottom: "12px",
                  textShadow: `0 0 60px ${GOLD}18`,
                }}
              >
                04
              </span>
              <h2
                style={{
                  fontFamily: "var(--font-outfit), sans-serif",
                  fontSize: "clamp(1.3rem, 2.2vw, 2rem)",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Plans
              </h2>
            </div>

            <div
              className="pricing-grid"
              data-reveal
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "clamp(16px, 2vw, 28px)",
                alignItems: "start",
              }}
            >
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`pricing-card ${plan.highlight ? "pricing-card-pro" : ""}`}
                  style={{
                    border: plan.highlight
                      ? `2px solid ${GOLD}`
                      : `1.5px solid ${NAVY}18`,
                    background: plan.highlight
                      ? `linear-gradient(180deg, ${GOLD}08, ${PARCHMENT})`
                      : PARCHMENT,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* Pro badge */}
                  {plan.highlight && (
                    <div
                      style={{
                        background: GOLD,
                        color: NAVY,
                        fontFamily: "var(--font-outfit), sans-serif",
                        fontWeight: 700,
                        fontSize: "10px",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        textAlign: "center",
                        padding: "8px",
                      }}
                    >
                      Most Popular
                    </div>
                  )}

                  {/* Header */}
                  <div
                    style={{
                      padding: "clamp(28px, 3vw, 40px) clamp(24px, 2.5vw, 36px)",
                      borderBottom: `1px solid ${plan.highlight ? `${GOLD}30` : `${NAVY}10`}`,
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: "var(--font-outfit), sans-serif",
                        fontSize: "clamp(0.95rem, 1.3vw, 1.15rem)",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: "12px",
                        color: plan.highlight ? GOLD : NAVY,
                      }}
                    >
                      {plan.name}
                    </h3>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "6px",
                      }}
                    >
                      <span
                        className="display"
                        style={{
                          fontSize: "clamp(3rem, 5.5vw, 4.5rem)",
                          lineHeight: 1,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {plan.price}
                      </span>
                      <div>
                        <span
                          style={{
                            fontSize: "16px",
                            fontWeight: 600,
                            opacity: 0.6,
                          }}
                        >
                          EUR
                        </span>
                        <span
                          className="mono"
                          style={{
                            display: "block",
                            fontSize: "11px",
                            opacity: 0.35,
                            marginTop: "2px",
                          }}
                        >
                          /month
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div
                    style={{
                      padding: "clamp(20px, 2vw, 32px) clamp(24px, 2.5vw, 36px)",
                    }}
                  >
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                      }}
                    >
                      {plan.features.map((feat, i) => (
                        <li
                          key={feat}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "12px",
                            padding: "10px 0",
                            borderBottom:
                              i < plan.features.length - 1
                                ? `1px solid ${NAVY}08`
                                : "none",
                            fontSize: "14px",
                            opacity: 0.65,
                            fontWeight: 400,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              color: plan.highlight ? GOLD : WARM,
                              fontSize: "12px",
                              lineHeight: "20px",
                              flexShrink: 0,
                              fontWeight: 700,
                            }}
                          >
                            +
                          </span>
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* CTA */}
                  <div
                    style={{
                      padding: "0 clamp(24px, 2.5vw, 36px) clamp(28px, 3vw, 40px)",
                    }}
                  >
                    {plan.highlight ? (
                      <a
                        href="#cta"
                        className="btn-gold"
                        style={{
                          width: "100%",
                          textAlign: "center",
                          display: "block",
                        }}
                      >
                        Choose Pro
                      </a>
                    ) : (
                      <a
                        href="#cta"
                        className="pricing-link"
                        style={{ width: "100%", textAlign: "center" }}
                      >
                        Choose {plan.name}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p
              data-reveal
              className="mono"
              style={{
                marginTop: "28px",
                fontSize: "10px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                opacity: 0.25,
              }}
            >
              All prices in EUR. Billed monthly. Cancel anytime.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════
            CTA — Dark Section
            ════════════════════════════════════════════ */}
        <section
          id="cta"
          style={{
            background: NAVY,
            position: "relative",
            overflow: "hidden",
            padding: "clamp(100px, 16vh, 240px) 0",
          }}
        >
          {/* Geometric decorations */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "clamp(400px, 60vw, 800px)",
              height: "clamp(400px, 60vw, 800px)",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${GOLD}12, transparent 70%)`,
              animation: "glowPulse 6s ease-in-out infinite",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />

          {/* Background ghost text */}
          <div
            aria-hidden="true"
            className="display"
            style={{
              position: "absolute",
              right: "-4%",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "clamp(18rem, 35vw, 50rem)",
              lineHeight: 1,
              opacity: 0.04,
              color: PARCHMENT,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            GO
          </div>

          {/* Subtle grid in dark section */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `linear-gradient(${PARCHMENT}05 1px, transparent 1px), linear-gradient(90deg, ${PARCHMENT}05 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
              pointerEvents: "none",
            }}
          />

          <div
            className="s-wrap"
            data-reveal
            style={{ position: "relative", zIndex: 1 }}
          >
            <div style={{ maxWidth: "800px" }}>
              <span
                className="mono"
                style={{
                  display: "block",
                  fontSize: "11px",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: GOLD,
                  opacity: 0.8,
                  marginBottom: "clamp(16px, 2vw, 32px)",
                }}
              >
                Ready to optimize your time?
              </span>

              <h2
                className="display cta-title"
                style={{
                  fontSize: "clamp(5rem, 14vw, 16rem)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.01em",
                  color: PARCHMENT,
                  marginBottom: "clamp(24px, 4vw, 48px)",
                }}
              >
                Begin<span style={{ color: GOLD }}>.</span>
              </h2>

              <p
                style={{
                  fontSize: "clamp(1rem, 1.5vw, 1.15rem)",
                  lineHeight: 1.7,
                  color: PARCHMENT,
                  opacity: 0.5,
                  maxWidth: "480px",
                  marginBottom: "clamp(32px, 4vw, 56px)",
                }}
              >
                Start with the free tier. No credit card required. Your
                calendar deserves better than guesswork.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href="/sign-in"
                  className="btn-gold"
                  style={{ fontSize: "14px", padding: "18px 56px" }}
                >
                  Start Free
                </a>
                <span
                  className="mono"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: PARCHMENT,
                    opacity: 0.25,
                  }}
                >
                  Setup in 2 minutes
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════
            FOOTER
            ════════════════════════════════════════════ */}
        <footer
          style={{
            background: NAVY,
            borderTop: `1px solid ${PARCHMENT}10`,
          }}
        >
          <div className="s-wrap">
            <div
              style={{
                padding: "clamp(40px, 5vw, 64px) 0",
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                gap: "clamp(24px, 4vw, 64px)",
                alignItems: "start",
              }}
            >
              {/* Brand */}
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-outfit), sans-serif",
                    fontWeight: 800,
                    fontSize: "16px",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: PARCHMENT,
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      background: GOLD,
                      borderRadius: "50%",
                      display: "inline-block",
                    }}
                  />
                  Auto Cron
                </div>
                <p
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.6,
                    color: PARCHMENT,
                    opacity: 0.35,
                    maxWidth: "280px",
                  }}
                >
                  Intelligent auto-scheduling that puts your priorities first.
                </p>
              </div>

              {/* Links */}
              <div>
                <h4
                  className="mono"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: GOLD,
                    opacity: 0.6,
                    marginBottom: "20px",
                  }}
                >
                  Product
                </h4>
                {[
                  { label: "Features", href: "#features" },
                  { label: "Process", href: "#process" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "Dashboard", href: "/calendar" },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: PARCHMENT,
                      opacity: 0.45,
                      textDecoration: "none",
                      padding: "6px 0",
                      transition: "opacity 0.25s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "0.8")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "0.45")
                    }
                  >
                    {link.label}
                  </a>
                ))}
              </div>

              {/* Meta */}
              <div>
                <h4
                  className="mono"
                  style={{
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: GOLD,
                    opacity: 0.6,
                    marginBottom: "20px",
                  }}
                >
                  Company
                </h4>
                {["Privacy", "Terms", "Contact"].map((link) => (
                  <a
                    key={link}
                    href={`#${link.toLowerCase()}`}
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: PARCHMENT,
                      opacity: 0.45,
                      textDecoration: "none",
                      padding: "6px 0",
                      transition: "opacity 0.25s ease",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.opacity = "0.8")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "0.45")
                    }
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            {/* Bottom bar */}
            <div
              style={{
                borderTop: `1px solid ${PARCHMENT}10`,
                padding: "24px 0 clamp(32px, 4vw, 48px)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <p
                className="mono"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  color: PARCHMENT,
                  opacity: 0.25,
                }}
              >
                {new Date().getFullYear()} Auto Cron. All rights reserved.
              </p>
              <p
                className="mono"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: PARCHMENT,
                  opacity: 0.15,
                }}
              >
                Swiss Typographic Style
              </p>
            </div>
          </div>
        </footer>

        {showDesignSwitcher && <DesignSwitcher />}
      </div>
    </div>
  );
}
