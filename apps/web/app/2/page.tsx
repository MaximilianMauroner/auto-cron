"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { JetBrains_Mono, Lexend } from "next/font/google";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-jetbrains",
});

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-lexend",
});

/* ───────────── Counter Hook ───────────── */
function useCountUp(end: number, duration: number, start: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf: number;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(eased * end));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [end, duration, start]);
  return value;
}

/* ───────────── Intersection Observer Hook ───────────── */
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e && e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ───────────── Terminal Demo Component ───────────── */
const terminalLines = [
  { text: "> auto_cron schedule --user max --horizon 7d", color: "#00FFD1", delay: 0 },
  { text: "[INFO] Loading 12 tasks, 4 habits, 23 calendar events...", color: "#E0E0E0", delay: 600 },
  { text: "[INFO] Analyzing priority matrix...", color: "#E0E0E0", delay: 1200 },
  { text: "[████████████████████] 100%", color: "#00FFD1", delay: 1800 },
  { text: "[INFO] Resolved 3 conflicts", color: "#FFE600", delay: 2400 },
  { text: "[INFO] Scheduled: 12 tasks, 28 habit slots", color: "#E0E0E0", delay: 3000 },
  { text: '[OK] Schedule deployed to Google Calendar \u2713', color: "#00FFD1", delay: 3600 },
];

function TerminalDemo() {
  const { ref, inView } = useInView(0.3);
  const [visibleLines, setVisibleLines] = useState(0);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    if (!inView) return;
    terminalLines.forEach((line, i) => {
      const t = setTimeout(() => setVisibleLines(i + 1), line.delay);
      timeoutsRef.current.push(t);
    });
    return () => timeoutsRef.current.forEach(clearTimeout);
  }, [inView]);

  return (
    <div ref={ref} className="terminal-window" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="terminal-bar">
        <span className="dot dot-red" />
        <span className="dot dot-yellow" />
        <span className="dot dot-green" />
        <span style={{ marginLeft: 12, color: "#555566", fontSize: 13 }}>auto_cron --demo</span>
      </div>
      <div style={{ padding: "20px 24px", minHeight: 220, fontFamily: "var(--font-jetbrains)", fontSize: 14, lineHeight: 1.8 }}>
        {terminalLines.slice(0, visibleLines).map((line, i) => (
          <div key={i} className="term-line-animate" style={{ color: line.color }}>
            {line.text}
          </div>
        ))}
        {visibleLines >= terminalLines.length && (
          <span style={{ color: "#00FFD1" }}>
            {">"} <span className="cursor-blink">&nbsp;</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────────── Module Card Component ───────────── */
function ModuleCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="module-card">
      <div className="terminal-bar">
        <span className="dot dot-red" />
        <span className="dot dot-yellow" />
        <span className="dot dot-green" />
        <span style={{ marginLeft: 12, color: "#00FFD1", fontSize: 13, fontFamily: "var(--font-jetbrains)" }}>{name}</span>
      </div>
      <div style={{ padding: "20px 24px", fontFamily: "var(--font-jetbrains)", fontSize: 13, lineHeight: 1.7, color: "#E0E0E0" }}>
        <span style={{ color: "#555566" }}>// </span>{description}
      </div>
    </div>
  );
}

/* ───────────── Pricing Card Component ───────────── */
function PricingCard({
  filename,
  plan,
  price,
  tasks,
  habits,
  runs,
  extra,
  highlighted,
}: {
  filename: string;
  plan: string;
  price: string;
  tasks: string;
  habits: string;
  runs: string;
  extra?: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`pricing-card ${highlighted ? "pricing-highlighted" : ""}`}>
      {highlighted && <div className="recommended-badge">RECOMMENDED</div>}
      <div className="terminal-bar">
        <span className="dot dot-red" />
        <span className="dot dot-yellow" />
        <span className="dot dot-green" />
        <span style={{ marginLeft: 12, color: "#555566", fontSize: 13, fontFamily: "var(--font-jetbrains)" }}>{filename}</span>
      </div>
      <div style={{ padding: "24px", fontFamily: "var(--font-jetbrains)", fontSize: 13, lineHeight: 2 }}>
        <span style={{ color: "#555566" }}>{"{"}</span>
        <br />
        <span>&nbsp;&nbsp;</span><span style={{ color: "#00FFD1" }}>&quot;plan&quot;</span><span style={{ color: "#555566" }}>: </span><span style={{ color: "#FFE600" }}>&quot;{plan}&quot;</span><span style={{ color: "#555566" }}>,</span>
        <br />
        <span>&nbsp;&nbsp;</span><span style={{ color: "#00FFD1" }}>&quot;price&quot;</span><span style={{ color: "#555566" }}>: </span><span style={{ color: "#FFE600" }}>&quot;{price}&quot;</span><span style={{ color: "#555566" }}>,</span>
        <br />
        <span>&nbsp;&nbsp;</span><span style={{ color: "#00FFD1" }}>&quot;tasks&quot;</span><span style={{ color: "#555566" }}>: </span><span style={{ color: "#FF00AA" }}>{tasks}</span><span style={{ color: "#555566" }}>,</span>
        <br />
        <span>&nbsp;&nbsp;</span><span style={{ color: "#00FFD1" }}>&quot;habits&quot;</span><span style={{ color: "#555566" }}>: </span><span style={{ color: "#FF00AA" }}>{habits}</span><span style={{ color: "#555566" }}>,</span>
        <br />
        <span>&nbsp;&nbsp;</span><span style={{ color: "#00FFD1" }}>&quot;runs&quot;</span><span style={{ color: "#555566" }}>: </span><span style={{ color: "#FF00AA" }}>{runs}</span><span style={{ color: "#555566" }}>,</span>
        <br />
        <span>&nbsp;&nbsp;</span><span style={{ color: "#00FFD1" }}>&quot;google_sync&quot;</span><span style={{ color: "#555566" }}>: </span><span style={{ color: "#00FFD1" }}>true</span>
        {extra && (
          <>
            <span style={{ color: "#555566" }}>,</span>
            <br />
            <span>&nbsp;&nbsp;</span><span style={{ color: "#00FFD1" }}>&quot;analytics&quot;</span><span style={{ color: "#555566" }}>: </span><span style={{ color: "#00FFD1" }}>true</span>
          </>
        )}
        <br />
        <span style={{ color: "#555566" }}>{"}"}</span>
      </div>
    </div>
  );
}

/* ───────────── Pipeline Step Component ───────────── */
function PipelineStep({ command, description, index }: { command: string; description: string; index: number }) {
  const { ref, inView } = useInView(0.3);
  return (
    <div ref={ref} className={`pipeline-step ${inView ? "pipeline-visible" : ""}`} style={{ animationDelay: `${index * 200}ms` }}>
      <div className="pulse-dot" />
      <div style={{ fontFamily: "var(--font-jetbrains)", fontSize: 15, color: "#00FFD1", marginBottom: 8 }}>
        {command}
      </div>
      <div style={{ fontFamily: "var(--font-lexend)", fontSize: 14, color: "#E0E0E0", lineHeight: 1.6 }}>
        {description}
      </div>
    </div>
  );
}

/* ═══════════════ MAIN PAGE ═══════════════ */
export default function LandingPage() {
  /* ── Hero typewriter states ── */
  const [heroPhase, setHeroPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setHeroPhase(1), 400),
      setTimeout(() => setHeroPhase(2), 1000),
      setTimeout(() => setHeroPhase(3), 1600),
      setTimeout(() => setHeroPhase(4), 2200),
      setTimeout(() => setHeroPhase(5), 2800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  /* ── Stat counters ── */
  const statsRef = useInView(0.4);
  const countPriority = useCountUp(5, 1200, statsRef.inView);
  const countHorizon = useCountUp(75, 1800, statsRef.inView);

  /* ── Smooth scroll helper ── */
  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className={`${jetbrains.variable} ${lexend.variable} landing-root`}>
      <style jsx global>{`
        /* ───── CSS Keyframes ───── */
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.4; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 8px #00FFD1, 0 0 24px #00FFD133; }
          50% { box-shadow: 0 0 16px #00FFD1, 0 0 48px #00FFD155; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dashFlow {
          to { stroke-dashoffset: -20; }
        }
        @keyframes termFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ───── Globals ───── */
        .landing-root {
          background: #0A0A0F;
          color: #E0E0E0;
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
          font-family: var(--font-lexend), sans-serif;
        }

        /* ───── Grid Background ───── */
        .grid-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            repeating-linear-gradient(0deg,   transparent, transparent 59px, #1A1A2E 59px, #1A1A2E 60px),
            repeating-linear-gradient(90deg,  transparent, transparent 59px, #1A1A2E 59px, #1A1A2E 60px);
        }

        /* ───── Scanline ───── */
        .scanline {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 6px;
          background: linear-gradient(180deg, transparent, #00FFD118, transparent);
          z-index: 1;
          pointer-events: none;
          animation: scanline 6s linear infinite;
        }

        /* ───── Content wrapper ───── */
        .content-wrapper {
          position: relative;
          z-index: 2;
        }

        /* ───── Nav ───── */
        .nav-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          height: 56px;
          background: #0A0A0FE8;
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #1A1A2E;
          box-shadow: 0 1px 12px #00FFD122;
          font-family: var(--font-jetbrains), monospace;
        }
        .nav-brand {
          font-size: 15px;
          font-weight: 500;
          color: #00FFD1;
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .nav-links {
          display: flex;
          gap: 24px;
        }
        .nav-link {
          font-size: 13px;
          color: #555566;
          cursor: pointer;
          transition: color 0.2s, text-shadow 0.2s;
          text-decoration: none;
          background: none;
          border: none;
          font-family: var(--font-jetbrains), monospace;
        }
        .nav-link:hover {
          color: #00FFD1;
          text-shadow: 0 0 10px #00FFD1;
        }

        /* ───── Cursor blink ───── */
        .cursor-blink {
          display: inline-block;
          width: 10px;
          height: 20px;
          background: #00FFD1;
          animation: blink 1s step-end infinite;
          vertical-align: middle;
          margin-left: 2px;
        }
        .cursor-blink-sm {
          display: inline-block;
          width: 8px;
          height: 16px;
          background: #00FFD1;
          animation: blink 1s step-end infinite;
          vertical-align: middle;
          margin-left: 2px;
        }

        /* ───── Hero ───── */
        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 120px 32px 80px;
          max-width: 1000px;
          margin: 0 auto;
        }
        .hero-line {
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .hero-line.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .hero-headline {
          font-family: var(--font-jetbrains), monospace;
          font-size: clamp(32px, 6vw, 64px);
          font-weight: 700;
          color: #FFFFFF;
          line-height: 1.1;
          margin: 24px 0 20px;
          text-shadow: 0 0 30px #00FFD133;
        }
        .hero-sub {
          font-family: var(--font-lexend), sans-serif;
          font-size: clamp(15px, 2vw, 18px);
          font-weight: 300;
          color: #E0E0E0;
          line-height: 1.7;
          max-width: 600px;
          margin-bottom: 36px;
        }
        .btn-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 64px;
        }
        .btn-execute {
          font-family: var(--font-jetbrains), monospace;
          font-size: 14px;
          font-weight: 500;
          padding: 12px 32px;
          border: 1px solid #00FFD1;
          color: #00FFD1;
          background: transparent;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 0 10px #00FFD133, 0 0 30px #00FFD111;
        }
        .btn-execute:hover {
          background: #00FFD115;
          box-shadow: 0 0 20px #00FFD166, 0 0 60px #00FFD133;
          text-shadow: 0 0 10px #00FFD1;
        }
        .btn-docs {
          font-family: var(--font-jetbrains), monospace;
          font-size: 14px;
          font-weight: 500;
          padding: 12px 32px;
          border: 1px solid #555566;
          color: #555566;
          background: transparent;
          cursor: pointer;
          transition: all 0.3s;
        }
        .btn-docs:hover {
          border-color: #E0E0E0;
          color: #E0E0E0;
        }

        /* ───── Stat boxes ───── */
        .stat-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          max-width: 720px;
        }
        .stat-box {
          background: #12121A;
          border: 1px solid #1A1A2E;
          border-top: 2px solid #00FFD1;
          padding: 24px 20px;
          text-align: center;
          box-shadow: 0 0 12px #00FFD111;
          animation: glowPulse 4s ease-in-out infinite;
        }
        .stat-num {
          font-family: var(--font-jetbrains), monospace;
          font-size: 36px;
          font-weight: 700;
          color: #00FFD1;
          text-shadow: 0 0 15px #00FFD144;
        }
        .stat-label {
          font-family: var(--font-jetbrains), monospace;
          font-size: 11px;
          color: #555566;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-top: 8px;
        }

        /* ───── Section ───── */
        .section {
          max-width: 1100px;
          margin: 0 auto;
          padding: 100px 32px;
        }
        .section-header {
          font-family: var(--font-jetbrains), monospace;
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 500;
          color: #00FFD1;
          margin-bottom: 48px;
          text-shadow: 0 0 10px #00FFD133;
        }

        /* ───── Module cards ───── */
        .modules-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        .module-card {
          background: #12121A;
          border: 1px solid #1A1A2E;
          transition: box-shadow 0.3s, border-color 0.3s;
        }
        .module-card:hover {
          border-color: #00FFD155;
          box-shadow: 0 0 20px #00FFD133, 0 0 40px #00FFD111;
        }
        .terminal-bar {
          display: flex;
          align-items: center;
          padding: 10px 16px;
          background: #0E0E16;
          border-bottom: 1px solid #1A1A2E;
          gap: 6px;
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .dot-red { background: #FF5F57; }
        .dot-yellow { background: #FEBC2E; }
        .dot-green { background: #28C840; }

        /* ───── Terminal Window ───── */
        .terminal-window {
          background: #0E0E16;
          border: 1px solid #1A1A2E;
          box-shadow: 0 0 30px #00FFD111;
        }
        .term-line-animate {
          animation: termFadeIn 0.3s ease forwards;
        }

        /* ───── Pipeline ───── */
        .pipeline-wrapper {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          position: relative;
        }
        .pipeline-step {
          padding: 24px 20px;
          position: relative;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .pipeline-step.pipeline-visible {
          opacity: 1;
          transform: translateY(0);
        }
        .pipeline-step:not(:last-child)::after {
          content: "";
          position: absolute;
          top: 38px;
          right: -2px;
          width: 24px;
          height: 2px;
          border-top: 2px dashed #00FFD155;
        }
        .pulse-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #00FFD1;
          margin-bottom: 16px;
          animation: pulse 2s ease-in-out infinite;
          box-shadow: 0 0 8px #00FFD1;
        }

        /* ───── Pricing ───── */
        .pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          align-items: start;
        }
        .pricing-card {
          background: #12121A;
          border: 1px solid #1A1A2E;
          position: relative;
          transition: box-shadow 0.3s, border-color 0.3s;
        }
        .pricing-card:hover {
          border-color: #555566;
        }
        .pricing-highlighted {
          border-color: #00FFD1 !important;
          box-shadow: 0 0 20px #00FFD133, 0 0 50px #00FFD111;
          animation: glowPulse 4s ease-in-out infinite;
        }
        .recommended-badge {
          position: absolute;
          top: -12px;
          right: 20px;
          background: #00FFD1;
          color: #0A0A0F;
          font-family: var(--font-jetbrains), monospace;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 12px;
          letter-spacing: 1px;
        }

        /* ───── CTA ───── */
        .cta-section {
          text-align: center;
          padding: 120px 32px;
        }
        .cta-headline {
          font-family: var(--font-jetbrains), monospace;
          font-size: clamp(24px, 4vw, 42px);
          font-weight: 500;
          color: #E0E0E0;
          margin-bottom: 32px;
        }
        .cta-btn {
          font-family: var(--font-jetbrains), monospace;
          font-size: 16px;
          font-weight: 700;
          padding: 16px 48px;
          border: 2px solid #00FFD1;
          color: #00FFD1;
          background: transparent;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 0 16px #00FFD144, 0 0 40px #00FFD122;
          letter-spacing: 2px;
        }
        .cta-btn:hover {
          background: #00FFD115;
          box-shadow: 0 0 30px #00FFD188, 0 0 80px #00FFD144;
          text-shadow: 0 0 12px #00FFD1;
        }

        /* ───── Footer ───── */
        .footer {
          text-align: center;
          padding: 40px 32px;
          border-top: 1px solid #1A1A2E;
          font-family: var(--font-jetbrains), monospace;
          font-size: 12px;
          color: #555566;
        }

        /* ───── Responsive ───── */
        @media (max-width: 900px) {
          .modules-grid,
          .pricing-grid {
            grid-template-columns: 1fr 1fr;
          }
          .pipeline-wrapper {
            grid-template-columns: 1fr 1fr;
            gap: 24px;
          }
          .pipeline-step:not(:last-child)::after {
            display: none;
          }
        }
        @media (max-width: 640px) {
          .modules-grid,
          .pricing-grid,
          .pipeline-wrapper {
            grid-template-columns: 1fr;
          }
          .stat-row {
            grid-template-columns: 1fr;
            max-width: 280px;
            margin: 0 auto;
          }
          .nav-links {
            gap: 12px;
          }
          .nav-link {
            font-size: 11px;
          }
          .hero {
            padding: 100px 20px 60px;
          }
          .section {
            padding: 60px 20px;
          }
          .btn-row {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>

      {/* ── Background ── */}
      <div className="grid-bg" />
      <div className="scanline" />

      <div className="content-wrapper">
        {/* ═══ NAVIGATION ═══ */}
        <nav className="nav-bar">
          <div className="nav-brand">
            <span style={{ color: "#555566", marginRight: 4 }}>&gt;</span>
            auto_cron
            <span className="cursor-blink-sm" />
          </div>
          <div className="nav-links">
            <button className="nav-link" onClick={() => scrollTo("features")}>
              ./features
            </button>
            <button className="nav-link" onClick={() => scrollTo("pricing")}>
              ./pricing
            </button>
            <button className="nav-link" onClick={() => scrollTo("cta")}>
              ./login
            </button>
          </div>
        </nav>

        {/* ═══ HERO ═══ */}
        <section className="hero">
          <div className={`hero-line ${heroPhase >= 1 ? "visible" : ""}`} style={{ fontFamily: "var(--font-jetbrains)", fontSize: 14, color: "#00FFD1", marginBottom: 4 }}>
            &gt; initializing auto_cron v2.0...
          </div>
          <div className={`hero-line ${heroPhase >= 2 ? "visible" : ""}`} style={{ fontFamily: "var(--font-jetbrains)", fontSize: 14, color: "#00FFD1", marginBottom: 8 }}>
            &gt; system: <span style={{ fontWeight: 700 }}>ONLINE</span>
          </div>
          <div className={`hero-line ${heroPhase >= 3 ? "visible" : ""}`}>
            <h1 className="hero-headline">
              YOUR SCHEDULE.
              <br />
              AUTOMATED.
              <span className="cursor-blink" />
            </h1>
          </div>
          <div className={`hero-line ${heroPhase >= 4 ? "visible" : ""}`}>
            <p className="hero-sub">
              Priority-based algorithm. Habit intelligence. Calendar fusion.
              Auto Cron thinks so you don&apos;t have to.
            </p>
          </div>
          <div className={`hero-line ${heroPhase >= 5 ? "visible" : ""}`}>
            <div className="btn-row">
              <button className="btn-execute" onClick={() => scrollTo("cta")}>
                [EXECUTE]
              </button>
              <button className="btn-docs" onClick={() => scrollTo("features")}>
                [VIEW DOCS]
              </button>
            </div>
          </div>

          {/* Stat boxes */}
          <div ref={statsRef.ref} className="stat-row">
            <div className="stat-box">
              <div className="stat-num">{countPriority}</div>
              <div className="stat-label">Priority Levels</div>
            </div>
            <div className="stat-box">
              <div className="stat-num">{countHorizon}</div>
              <div className="stat-label">Day Horizon</div>
            </div>
            <div className="stat-box">
              <div className="stat-num" style={{ color: "#FF00AA", textShadow: "0 0 15px #FF00AA44" }}>&infin;</div>
              <div className="stat-label">Scheduling Runs</div>
            </div>
          </div>
        </section>

        {/* ═══ FEATURES — SYSTEM MODULES ═══ */}
        <section id="features" className="section">
          <h2 className="section-header">
            <span style={{ color: "#555566" }}>##</span> system.modules
          </h2>
          <div className="modules-grid">
            <ModuleCard
              name="task.orchestrator"
              description="Priority-weighted scheduling across 5 levels. Backlog -> Queue -> Calendar. Automatic reflow."
            />
            <ModuleCard
              name="habit.engine"
              description="Daily, weekly, monthly rhythms. Preferred time windows. Smart placement."
            />
            <ModuleCard
              name="calendar.sync"
              description="Bidirectional Google Calendar integration. Real-time sync. Conflict resolution."
            />
            <ModuleCard
              name="schedule.solver"
              description="Greedy algorithm optimization. Deadline urgency x priority weight. Earliest available slot."
            />
            <ModuleCard
              name="time.guard"
              description="Working hours enforcement. Buffer zones. No scheduling outside your boundaries."
            />
            <ModuleCard
              name="horizon.planner"
              description="75-day forward planning. Automatic rescheduling cascade. Future-aware."
            />
          </div>
        </section>

        {/* ═══ EXECUTION FLOW ═══ */}
        <section className="section">
          <h2 className="section-header">
            <span style={{ color: "#555566" }}>##</span> execution.flow
          </h2>
          <div className="pipeline-wrapper">
            <PipelineStep
              index={0}
              command="$ input"
              description="Define tasks, set priorities (low -> blocker), configure habits"
            />
            <PipelineStep
              index={1}
              command="$ configure"
              description="Set working hours, connect Google Calendar, set preferences"
            />
            <PipelineStep
              index={2}
              command="$ execute"
              description="Algorithm processes: sort by urgency x weight, fill available slots"
            />
            <PipelineStep
              index={3}
              command="$ output"
              description="Optimized schedule deployed to your calendar. Live."
            />
          </div>
        </section>

        {/* ═══ LIVE TERMINAL DEMO ═══ */}
        <section className="section">
          <h2 className="section-header">
            <span style={{ color: "#555566" }}>##</span> live.demo
          </h2>
          <TerminalDemo />
        </section>

        {/* ═══ PRICING ═══ */}
        <section id="pricing" className="section">
          <h2 className="section-header">
            <span style={{ color: "#555566" }}>##</span> pricing.config
          </h2>
          <div className="pricing-grid">
            <PricingCard
              filename="basic.json"
              plan="basic"
              price="\u20AC5/month"
              tasks="50"
              habits="5"
              runs="100"
            />
            <PricingCard
              filename="pro.json"
              plan="pro"
              price="\u20AC8/month"
              tasks="200"
              habits="20"
              runs="500"
              highlighted
            />
            <PricingCard
              filename="premium.json"
              plan="premium"
              price="\u20AC16/month"
              tasks='"unlimited"'
              habits='"unlimited"'
              runs='"unlimited"'
              extra="analytics"
            />
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section id="cta" className="cta-section">
          <div className="cta-headline">
            <span style={{ color: "#555566" }}>&gt;</span> ready to automate?
            <span className="cursor-blink" />
          </div>
          <button className="cta-btn">[INITIALIZE]</button>
          <p style={{ fontFamily: "var(--font-lexend)", fontSize: 13, color: "#555566", marginTop: 20 }}>
            No credit card required. Free trial available.
          </p>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="footer">
          auto_cron v2.0 | &copy; 2025 | built for humans who value time
        </footer>
      </div>
    </div>
  );
}
