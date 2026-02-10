"use client";

import { Space_Mono, Syne } from "next/font/google";
import { useEffect, useRef, useState } from "react";

const syne = Syne({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
	variable: "--font-syne",
});

const spaceMono = Space_Mono({
	subsets: ["latin"],
	weight: ["400", "700"],
	variable: "--font-space-mono",
});

/* ─────────────────────────────────────────────
   Intersection Observer hook for fade-in
   ───────────────────────────────────────────── */
function useFadeIn() {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const obs = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting) {
					setVisible(true);
					obs.unobserve(el);
				}
			},
			{ threshold: 0.12 },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, []);

	return { ref, visible };
}

/* ─────────────────────────────────────────────
   Staggered children fade-in hook
   ───────────────────────────────────────────── */
function useStaggerFadeIn(count: number) {
	const ref = useRef<HTMLDivElement>(null);
	const [visibleIndices, setVisibleIndices] = useState<Set<number>>(new Set());

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const obs = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting) {
					for (let i = 0; i < count; i++) {
						setTimeout(() => {
							setVisibleIndices((prev) => new Set([...prev, i]));
						}, i * 120);
					}
					obs.unobserve(el);
				}
			},
			{ threshold: 0.1 },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [count]);

	return { ref, visibleIndices };
}

/* ═════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═════════════════════════════════════════════ */
export default function KonstruktLanding() {
	const [mobileNav, setMobileNav] = useState(false);

	return (
		<div
			className={`${syne.variable} ${spaceMono.variable}`}
			style={{
				fontFamily: "var(--font-space-mono), monospace",
				background: "#FAFAF8",
				color: "#0A0A0A",
				borderRadius: 0,
				minHeight: "100vh",
				overflowX: "hidden",
			}}
		>
			<style>{`
        *, *::before, *::after { border-radius: 0 !important; box-shadow: none !important; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes slowSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes slowSpinOffset { 0% { transform: rotate(15deg); } 100% { transform: rotate(375deg); } }
        @keyframes fadeUp { 0% { opacity:0; transform:translateY(32px); } 100% { opacity:1; transform:translateY(0); } }
        .fade-section { opacity:0; transform:translateY(32px); transition: opacity 0.7s cubic-bezier(.22,1,.36,1), transform 0.7s cubic-bezier(.22,1,.36,1); }
        .fade-section.visible { opacity:1; transform:translateY(0); }
        .stagger-child { opacity:0; transform:translateY(24px); transition: opacity 0.5s cubic-bezier(.22,1,.36,1), transform 0.5s cubic-bezier(.22,1,.36,1); }
        .stagger-child.visible { opacity:1; transform:translateY(0); }
        .btn-konstrukt { transition: background 0.2s, color 0.2s; }
        .card-hover { transition: background 0.3s, color 0.3s; }
      `}</style>

			{/* ═══════════════ NAVIGATION ═══════════════ */}
			<Navigation mobileNav={mobileNav} setMobileNav={setMobileNav} />

			{/* ═══════════════ HERO ═══════════════ */}
			<HeroSection />

			{/* ═══════════════ MANIFESTO STRIP ═══════════════ */}
			<ManifestoStrip />

			{/* ═══════════════ MODULES / FEATURES ═══════════════ */}
			<ModulesSection />

			{/* ═══════════════ PROCESS ═══════════════ */}
			<ProcessSection />

			{/* ═══════════════ SPECIFICATIONS ═══════════════ */}
			<SpecificationsSection />

			{/* ═══════════════ PRICING ═══════════════ */}
			<PricingSection />

			{/* ═══════════════ CTA ═══════════════ */}
			<CTASection />

			{/* ═══════════════ FOOTER ═══════════════ */}
			<Footer />
		</div>
	);
}

/* ─────────────────────────────────────────────
   NAVIGATION
   ───────────────────────────────────────────── */
function Navigation({
	mobileNav,
	setMobileNav,
}: {
	mobileNav: boolean;
	setMobileNav: (v: boolean) => void;
}) {
	return (
		<nav
			style={{
				borderBottom: "3px solid #0A0A0A",
				background: "#FAFAF8",
				position: "sticky",
				top: 0,
				zIndex: 100,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					maxWidth: 1400,
					margin: "0 auto",
					padding: "0 24px",
					height: 64,
				}}
			>
				{/* Logo */}
				<div
					style={{
						fontFamily: "var(--font-syne), sans-serif",
						fontWeight: 800,
						fontSize: "1.35rem",
						letterSpacing: "0.18em",
						textTransform: "uppercase" as const,
					}}
				>
					AUTO CRON
				</div>

				{/* Desktop Nav */}
				<div
					className="hidden md:flex"
					style={{
						alignItems: "center",
						gap: 0,
						fontFamily: "var(--font-space-mono), monospace",
						fontSize: "0.8rem",
						fontWeight: 400,
						letterSpacing: "0.08em",
						textTransform: "uppercase" as const,
					}}
				>
					{["FEATURES", "PRICING", "LOGIN"].map((item, i) => (
						<span key={item} style={{ display: "flex", alignItems: "center" }}>
							{i > 0 && (
								<span
									style={{
										color: "#E63320",
										margin: "0 16px",
										fontWeight: 700,
										fontSize: "1rem",
										userSelect: "none",
									}}
								>
									|
								</span>
							)}
							<a
								href={`#${item.toLowerCase()}`}
								className="btn-konstrukt"
								style={{
									padding: "6px 12px",
									border: "2px solid transparent",
									textDecoration: "none",
									color: "#0A0A0A",
								}}
								onMouseEnter={(e) => {
									(e.target as HTMLElement).style.border = "2px solid #0A0A0A";
								}}
								onMouseLeave={(e) => {
									(e.target as HTMLElement).style.border = "2px solid transparent";
								}}
							>
								{item}
							</a>
						</span>
					))}
				</div>

				{/* Mobile burger */}
				<button
					className="md:hidden"
					onClick={() => setMobileNav(!mobileNav)}
					aria-label="Toggle menu"
					style={{
						background: "none",
						border: "3px solid #0A0A0A",
						width: 44,
						height: 44,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						cursor: "pointer",
						flexDirection: "column",
						gap: 5,
					}}
				>
					<span
						style={{
							display: "block",
							width: 20,
							height: 3,
							background: "#0A0A0A",
							transition: "transform 0.2s",
							transform: mobileNav ? "rotate(45deg) translateY(4px)" : "none",
						}}
					/>
					<span
						style={{
							display: "block",
							width: 20,
							height: 3,
							background: "#0A0A0A",
							transition: "opacity 0.2s",
							opacity: mobileNav ? 0 : 1,
						}}
					/>
					<span
						style={{
							display: "block",
							width: 20,
							height: 3,
							background: "#0A0A0A",
							transition: "transform 0.2s",
							transform: mobileNav ? "rotate(-45deg) translateY(-4px)" : "none",
						}}
					/>
				</button>
			</div>

			{/* Mobile menu */}
			{mobileNav && (
				<div
					className="md:hidden"
					style={{
						borderTop: "3px solid #0A0A0A",
						background: "#FAFAF8",
						padding: "16px 24px",
						display: "flex",
						flexDirection: "column",
						gap: 12,
						fontFamily: "var(--font-space-mono), monospace",
						fontSize: "0.85rem",
						textTransform: "uppercase" as const,
						letterSpacing: "0.08em",
					}}
				>
					{["FEATURES", "PRICING", "LOGIN"].map((item) => (
						<a
							key={item}
							href={`#${item.toLowerCase()}`}
							onClick={() => setMobileNav(false)}
							style={{
								textDecoration: "none",
								color: "#0A0A0A",
								padding: "8px 0",
								borderBottom: "2px solid #F0F0EC",
							}}
						>
							{item}
						</a>
					))}
				</div>
			)}
		</nav>
	);
}

/* ─────────────────────────────────────────────
   HERO
   ───────────────────────────────────────────── */
function HeroSection() {
	return (
		<section
			style={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				borderBottom: "3px solid #0A0A0A",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					maxWidth: 1400,
					margin: "0 auto",
					padding: "80px 24px",
					width: "100%",
					display: "grid",
					gap: 48,
				}}
				className="grid-cols-1 md:grid-cols-[65fr_35fr]"
			>
				{/* Left */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						gap: 28,
					}}
				>
					<span
						style={{
							fontFamily: "var(--font-space-mono), monospace",
							fontSize: "0.85rem",
							fontWeight: 700,
							color: "#E63320",
							letterSpacing: "0.1em",
							textTransform: "uppercase" as const,
						}}
					>
						SCHEDULING SYSTEM V2.0
					</span>

					<h1
						style={{
							fontFamily: "var(--font-syne), sans-serif",
							fontWeight: 800,
							fontSize: "clamp(2.8rem, 6vw, 5.2rem)",
							lineHeight: 1.02,
							letterSpacing: "-0.02em",
							color: "#0A0A0A",
							margin: 0,
						}}
					>
						AUTOMATE
						<br />
						YOUR TIME
					</h1>

					<p
						style={{
							fontFamily: "var(--font-space-mono), monospace",
							fontSize: "clamp(0.85rem, 1.1vw, 1rem)",
							lineHeight: 1.7,
							color: "#6B6B6B",
							maxWidth: 540,
							margin: 0,
						}}
					>
						Priority-based algorithm places your tasks, habits, and calendar events into the optimal
						schedule. Five priority levels. 75-day horizon. Zero manual effort.
					</p>

					<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
						<a
							href="#pricing"
							className="btn-konstrukt"
							style={{
								fontFamily: "var(--font-space-mono), monospace",
								fontWeight: 700,
								fontSize: "0.85rem",
								letterSpacing: "0.06em",
								textTransform: "uppercase" as const,
								background: "#E63320",
								color: "#fff",
								border: "3px solid #0A0A0A",
								padding: "14px 32px",
								textDecoration: "none",
								cursor: "pointer",
								display: "inline-block",
							}}
							onMouseEnter={(e) => {
								const t = e.currentTarget;
								t.style.background = "#0A0A0A";
								t.style.color = "#E63320";
							}}
							onMouseLeave={(e) => {
								const t = e.currentTarget;
								t.style.background = "#E63320";
								t.style.color = "#fff";
							}}
						>
							START NOW &rarr;
						</a>
						<a
							href="#features"
							className="btn-konstrukt"
							style={{
								fontFamily: "var(--font-space-mono), monospace",
								fontWeight: 700,
								fontSize: "0.85rem",
								letterSpacing: "0.06em",
								textTransform: "uppercase" as const,
								background: "#FAFAF8",
								color: "#0A0A0A",
								border: "3px solid #0A0A0A",
								padding: "14px 32px",
								textDecoration: "none",
								cursor: "pointer",
								display: "inline-block",
							}}
							onMouseEnter={(e) => {
								const t = e.currentTarget;
								t.style.background = "#0A0A0A";
								t.style.color = "#FAFAF8";
							}}
							onMouseLeave={(e) => {
								const t = e.currentTarget;
								t.style.background = "#FAFAF8";
								t.style.color = "#0A0A0A";
							}}
						>
							HOW IT WORKS
						</a>
					</div>
				</div>

				{/* Right — geometric composition */}
				<div style={{ position: "relative", minHeight: 380 }} className="hidden md:block">
					{/* Yellow circle */}
					<div
						style={{
							position: "absolute",
							top: 20,
							right: 10,
							width: 240,
							height: 240,
							borderRadius: "50%",
							background: "#F5C518",
							animation: "slowSpin 40s linear infinite",
						}}
					>
						<span
							style={{
								position: "absolute",
								top: "50%",
								left: "50%",
								transform: "translate(-50%,-50%)",
								fontFamily: "var(--font-syne), sans-serif",
								fontWeight: 800,
								fontSize: "1.6rem",
								color: "#0A0A0A",
								whiteSpace: "nowrap",
							}}
						>
							09:00
						</span>
					</div>

					{/* Blue square */}
					<div
						style={{
							position: "absolute",
							top: 140,
							right: 120,
							width: 180,
							height: 180,
							background: "#2B4AE8",
							animation: "slowSpinOffset 50s linear infinite",
						}}
					>
						<span
							style={{
								position: "absolute",
								top: "50%",
								left: "50%",
								transform: "translate(-50%,-50%) rotate(-15deg)",
								fontFamily: "var(--font-syne), sans-serif",
								fontWeight: 800,
								fontSize: "1.4rem",
								color: "#fff",
								whiteSpace: "nowrap",
							}}
						>
							14:30
						</span>
					</div>

					{/* Red triangle */}
					<div
						style={{
							position: "absolute",
							bottom: 30,
							right: 40,
							width: 100,
							height: 100,
							background: "#E63320",
							clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
						}}
					>
						<span
							style={{
								position: "absolute",
								bottom: 14,
								left: "50%",
								transform: "translateX(-50%)",
								fontFamily: "var(--font-syne), sans-serif",
								fontWeight: 800,
								fontSize: "0.85rem",
								color: "#fff",
								whiteSpace: "nowrap",
							}}
						>
							18:00
						</span>
					</div>

					{/* Small decorative black circle */}
					<div
						style={{
							position: "absolute",
							top: 0,
							right: 260,
							width: 48,
							height: 48,
							borderRadius: "50%",
							background: "#0A0A0A",
						}}
					/>

					{/* Small decorative red square */}
					<div
						style={{
							position: "absolute",
							bottom: 80,
							right: 280,
							width: 32,
							height: 32,
							background: "#E63320",
							border: "3px solid #0A0A0A",
						}}
					/>
				</div>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────
   MANIFESTO STRIP
   ───────────────────────────────────────────── */
function ManifestoStrip() {
	const text =
		"TASKS \u2022 HABITS \u2022 CALENDAR \u2022 PRIORITIES \u2022 AUTOMATION \u2022 SCHEDULING \u2022 ";
	const repeated = text.repeat(8);

	return (
		<div
			style={{
				background: "#0A0A0A",
				overflow: "hidden",
				borderBottom: "3px solid #0A0A0A",
				padding: "18px 0",
			}}
		>
			<div
				style={{
					display: "flex",
					whiteSpace: "nowrap",
					animation: "marquee 30s linear infinite",
					width: "max-content",
				}}
			>
				<span
					style={{
						fontFamily: "var(--font-syne), sans-serif",
						fontWeight: 700,
						fontSize: "clamp(1.3rem, 2.5vw, 2rem)",
						color: "#fff",
						letterSpacing: "0.06em",
					}}
				>
					{repeated}
				</span>
				<span
					style={{
						fontFamily: "var(--font-syne), sans-serif",
						fontWeight: 700,
						fontSize: "clamp(1.3rem, 2.5vw, 2rem)",
						color: "#fff",
						letterSpacing: "0.06em",
					}}
				>
					{repeated}
				</span>
			</div>
		</div>
	);
}

/* ─────────────────────────────────────────────
   MODULES / FEATURES
   ───────────────────────────────────────────── */
const modules = [
	{
		title: "TASK ENGINE",
		desc: "Five priority levels: low, medium, high, critical, blocker. Backlog and queue management. Drag-and-drop scheduling.",
		span: 2,
		bg: "#F5C518",
		color: "#0A0A0A",
		accent: "#E63320",
		accentShape: "square",
	},
	{
		title: "HABIT SYSTEM",
		desc: "Daily, weekly, monthly. Preferred time windows. Consistent rhythm.",
		span: 1,
		bg: "#FAFAF8",
		color: "#0A0A0A",
		accent: "#2B4AE8",
		accentShape: "circle",
	},
	{
		title: "CALENDAR SYNC",
		desc: "Bidirectional Google Calendar. Real-time. Conflict resolution.",
		span: 1,
		bg: "#FAFAF8",
		color: "#0A0A0A",
		accent: "#E63320",
		accentShape: "square",
	},
	{
		title: "WORKING HOURS",
		desc: "Your boundaries, respected.",
		span: 1,
		bg: "#FAFAF8",
		color: "#0A0A0A",
		accent: "#F5C518",
		accentShape: "circle",
	},
	{
		title: "AUTO-REFLOW",
		desc: "Priorities shift? Schedule adapts.",
		span: 1,
		bg: "#FAFAF8",
		color: "#0A0A0A",
		accent: "#2B4AE8",
		accentShape: "triangle",
	},
	{
		title: "75-DAY HORIZON",
		desc: "Plan further. See further. Schedule further.",
		span: 2,
		bg: "#2B4AE8",
		color: "#fff",
		accent: "#F5C518",
		accentShape: "circle",
	},
];

function ModulesSection() {
	const { ref, visibleIndices } = useStaggerFadeIn(modules.length);

	return (
		<section
			id="features"
			ref={ref}
			style={{
				maxWidth: 1400,
				margin: "0 auto",
				padding: "96px 24px",
			}}
		>
			{/* Header */}
			<div style={{ marginBottom: 56 }}>
				<h2
					style={{
						fontFamily: "var(--font-syne), sans-serif",
						fontWeight: 800,
						fontSize: "clamp(2.6rem, 5vw, 4.5rem)",
						letterSpacing: "-0.02em",
						margin: 0,
						display: "inline-block",
					}}
				>
					MODULES
				</h2>
				<div
					style={{
						width: 120,
						height: 8,
						background: "#E63320",
						marginTop: 12,
					}}
				/>
			</div>

			{/* Bento grid */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
					gap: 0,
				}}
				className="md:!grid-cols-[1fr_1fr]"
			>
				{modules.map((m, i) => (
					<ModuleCard key={m.title} m={m} visible={visibleIndices.has(i)} />
				))}
			</div>
		</section>
	);
}

function ModuleCard({
	m,
	visible,
}: {
	m: (typeof modules)[number];
	visible: boolean;
}) {
	const [hovered, setHovered] = useState(false);

	const defaultBg = m.bg;
	const defaultColor = m.color;
	const hoverBg = m.bg === "#FAFAF8" ? "#0A0A0A" : m.bg === "#F5C518" ? "#0A0A0A" : "#fff";
	const hoverColor = m.bg === "#FAFAF8" ? "#fff" : m.bg === "#F5C518" ? "#F5C518" : "#2B4AE8";

	return (
		<div
			className={`stagger-child card-hover ${visible ? "visible" : ""}`}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				gridColumn: `span ${m.span}`,
				border: "3px solid #0A0A0A",
				padding: "36px 32px",
				background: hovered ? hoverBg : defaultBg,
				color: hovered ? hoverColor : defaultColor,
				position: "relative",
				overflow: "hidden",
				marginTop: -3,
				marginLeft: -3,
				cursor: "default",
				minHeight: m.span === 2 ? 200 : 180,
				display: "flex",
				flexDirection: "column",
				justifyContent: "flex-end",
			}}
		>
			{/* Accent shape */}
			<div
				style={{
					position: "absolute",
					top: 16,
					right: 16,
					width: 28,
					height: 28,
					background: m.accent,
					borderRadius: m.accentShape === "circle" ? "50%" : 0,
					clipPath:
						m.accentShape === "triangle" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : undefined,
					opacity: hovered ? 0.5 : 1,
					transition: "opacity 0.3s",
				}}
			/>

			<h3
				style={{
					fontFamily: "var(--font-syne), sans-serif",
					fontWeight: 800,
					fontSize: "clamp(1.3rem, 2vw, 1.7rem)",
					letterSpacing: "0.02em",
					margin: "0 0 10px 0",
				}}
			>
				{m.title}
			</h3>
			<p
				style={{
					fontFamily: "var(--font-space-mono), monospace",
					fontSize: "0.85rem",
					lineHeight: 1.6,
					margin: 0,
					opacity: 0.85,
					maxWidth: 480,
				}}
			>
				{m.desc}
			</p>
		</div>
	);
}

/* ─────────────────────────────────────────────
   PROCESS
   ───────────────────────────────────────────── */
const steps = [
	{
		num: "01",
		name: "INPUT",
		desc: "Add tasks, habits, and calendar events. Set your priorities.",
		color: "#E63320",
	},
	{
		num: "02",
		name: "CONFIGURE",
		desc: "Define working hours, preferred time slots, and constraints.",
		color: "#2B4AE8",
	},
	{
		num: "03",
		name: "COMPUTE",
		desc: "Algorithm processes priorities, durations, and deadlines.",
		color: "#F5C518",
	},
	{
		num: "04",
		name: "DEPLOY",
		desc: "Schedule syncs to Google Calendar. Automated and complete.",
		color: "#0A0A0A",
	},
];

function ProcessSection() {
	const fade = useFadeIn();

	return (
		<section
			ref={fade.ref}
			className={`fade-section ${fade.visible ? "visible" : ""}`}
			style={{
				borderTop: "3px solid #0A0A0A",
				borderBottom: "3px solid #0A0A0A",
				background: "#F0F0EC",
			}}
		>
			<div
				style={{
					maxWidth: 1400,
					margin: "0 auto",
					padding: "96px 24px",
				}}
			>
				<h2
					style={{
						fontFamily: "var(--font-syne), sans-serif",
						fontWeight: 800,
						fontSize: "clamp(2.6rem, 5vw, 4.5rem)",
						letterSpacing: "-0.02em",
						margin: "0 0 56px 0",
					}}
				>
					PROCESS
				</h2>

				<div
					style={{
						display: "grid",
						gap: 0,
					}}
					className="grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]"
				>
					{steps.map((step, i) => (
						<div key={step.num} style={{ display: "contents" }}>
							<div
								style={{
									border: "3px solid #0A0A0A",
									borderTop: `6px solid ${step.color}`,
									background: "#FAFAF8",
									padding: "32px 24px",
									display: "flex",
									flexDirection: "column",
									gap: 12,
								}}
							>
								<span
									style={{
										fontFamily: "var(--font-syne), sans-serif",
										fontWeight: 800,
										fontSize: "3.2rem",
										color: step.color,
										lineHeight: 1,
									}}
								>
									{step.num}
								</span>
								<h4
									style={{
										fontFamily: "var(--font-syne), sans-serif",
										fontWeight: 700,
										fontSize: "1.15rem",
										letterSpacing: "0.04em",
										margin: 0,
									}}
								>
									{step.name}
								</h4>
								<p
									style={{
										fontFamily: "var(--font-space-mono), monospace",
										fontSize: "0.8rem",
										lineHeight: 1.6,
										color: "#6B6B6B",
										margin: 0,
									}}
								>
									{step.desc}
								</p>
							</div>
							{i < steps.length - 1 && (
								<div
									className="hidden md:flex"
									style={{
										alignItems: "center",
										justifyContent: "center",
										padding: "0 8px",
										fontSize: "2rem",
										color: "#0A0A0A",
										fontFamily: "var(--font-syne), sans-serif",
										fontWeight: 800,
									}}
								>
									&rarr;
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────
   SPECIFICATIONS
   ───────────────────────────────────────────── */
const specRows = [
	{ param: "Tasks", basic: "50/mo", pro: "200/mo", premium: "\u221E" },
	{ param: "Habits", basic: "5/mo", pro: "20/mo", premium: "\u221E" },
	{ param: "Scheduling", basic: "100/mo", pro: "500/mo", premium: "\u221E" },
	{ param: "Google Sync", basic: "\u2713", pro: "\u2713", premium: "\u2713" },
	{ param: "Analytics", basic: "\u2014", pro: "\u2014", premium: "\u2713" },
];

function SpecificationsSection() {
	const fade = useFadeIn();

	return (
		<section
			ref={fade.ref}
			className={`fade-section ${fade.visible ? "visible" : ""}`}
			style={{
				maxWidth: 1400,
				margin: "0 auto",
				padding: "96px 24px",
			}}
		>
			<h2
				style={{
					fontFamily: "var(--font-syne), sans-serif",
					fontWeight: 800,
					fontSize: "clamp(2.6rem, 5vw, 4.5rem)",
					letterSpacing: "-0.02em",
					margin: "0 0 48px 0",
				}}
			>
				SPECIFICATIONS
			</h2>

			<div style={{ overflowX: "auto" }}>
				<table
					style={{
						width: "100%",
						borderCollapse: "collapse",
						fontFamily: "var(--font-space-mono), monospace",
						fontSize: "0.85rem",
						minWidth: 600,
					}}
				>
					<thead>
						<tr>
							{["PARAMETER", "BASIC", "PRO", "PREMIUM"].map((h, i) => (
								<th
									key={h}
									style={{
										background: "#0A0A0A",
										color: "#fff",
										border: "3px solid #0A0A0A",
										padding: "14px 20px",
										textAlign: i === 0 ? "left" : "center",
										fontWeight: 700,
										letterSpacing: "0.06em",
										textTransform: "uppercase" as const,
									}}
								>
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{specRows.map((row) => (
							<tr key={row.param}>
								<td
									style={{
										border: "3px solid #0A0A0A",
										padding: "14px 20px",
										fontWeight: 700,
										textTransform: "uppercase" as const,
										letterSpacing: "0.04em",
										background: "#FAFAF8",
									}}
								>
									{row.param}
								</td>
								<td
									style={{
										border: "3px solid #0A0A0A",
										padding: "14px 20px",
										textAlign: "center",
										background: "#FAFAF8",
									}}
								>
									{row.basic}
								</td>
								<td
									style={{
										border: "3px solid #0A0A0A",
										padding: "14px 20px",
										textAlign: "center",
										background: "#F5C518",
										fontWeight: 700,
									}}
								>
									{row.pro}
								</td>
								<td
									style={{
										border: "3px solid #0A0A0A",
										padding: "14px 20px",
										textAlign: "center",
										background: "#FAFAF8",
									}}
								>
									{row.premium}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────
   PRICING
   ───────────────────────────────────────────── */
const plans = [
	{
		name: "BASIC",
		price: "\u20AC5",
		accentColor: "#E63320",
		bg: "#FAFAF8",
		color: "#0A0A0A",
		label: null,
		features: ["50 tasks/month", "5 habits", "100 schedulings", "Google Sync"],
	},
	{
		name: "PRO",
		price: "\u20AC8",
		accentColor: "#F5C518",
		bg: "#F5C518",
		color: "#0A0A0A",
		label: "RECOMMENDED",
		features: ["200 tasks/month", "20 habits", "500 schedulings", "Google Sync"],
	},
	{
		name: "PREMIUM",
		price: "\u20AC16",
		accentColor: "#2B4AE8",
		bg: "#FAFAF8",
		color: "#0A0A0A",
		label: null,
		features: [
			"Unlimited tasks",
			"Unlimited habits",
			"Unlimited schedulings",
			"Google Sync",
			"Analytics",
		],
	},
];

function PricingSection() {
	const { ref, visibleIndices } = useStaggerFadeIn(plans.length);

	return (
		<section
			id="pricing"
			ref={ref}
			style={{
				borderTop: "3px solid #0A0A0A",
				borderBottom: "3px solid #0A0A0A",
				background: "#F0F0EC",
			}}
		>
			<div
				style={{
					maxWidth: 1400,
					margin: "0 auto",
					padding: "96px 24px",
				}}
			>
				<h2
					style={{
						fontFamily: "var(--font-syne), sans-serif",
						fontWeight: 800,
						fontSize: "clamp(2.6rem, 5vw, 4.5rem)",
						letterSpacing: "-0.02em",
						margin: "0 0 56px 0",
					}}
				>
					PRICING
				</h2>

				<div
					style={{
						display: "grid",
						gap: 0,
					}}
					className="grid-cols-1 md:grid-cols-3"
				>
					{plans.map((plan, i) => (
						<div
							key={plan.name}
							className={`stagger-child ${visibleIndices.has(i) ? "visible" : ""}`}
							style={{
								border: "3px solid #0A0A0A",
								background: plan.bg,
								color: plan.color,
								padding: 0,
								marginLeft: i > 0 ? -3 : 0,
								marginTop: -3,
								position: "relative",
								display: "flex",
								flexDirection: "column",
							}}
						>
							{/* Top accent bar (non-yellow cards) */}
							{plan.bg === "#FAFAF8" && (
								<div
									style={{
										height: 6,
										background: plan.accentColor,
									}}
								/>
							)}

							<div
								style={{ padding: "36px 32px", flex: 1, display: "flex", flexDirection: "column" }}
							>
								{/* Label */}
								{plan.label && (
									<span
										style={{
											display: "inline-block",
											fontFamily: "var(--font-space-mono), monospace",
											fontSize: "0.7rem",
											fontWeight: 700,
											letterSpacing: "0.1em",
											textTransform: "uppercase" as const,
											background: "#E63320",
											color: "#fff",
											padding: "4px 12px",
											marginBottom: 16,
											alignSelf: "flex-start",
										}}
									>
										{plan.label}
									</span>
								)}

								<h3
									style={{
										fontFamily: "var(--font-syne), sans-serif",
										fontWeight: 800,
										fontSize: "1.1rem",
										letterSpacing: "0.1em",
										margin: "0 0 16px 0",
									}}
								>
									{plan.name}
								</h3>

								<span
									style={{
										fontFamily: "var(--font-syne), sans-serif",
										fontWeight: 800,
										fontSize: "clamp(3rem, 5vw, 4.2rem)",
										lineHeight: 1,
										display: "block",
										marginBottom: 8,
									}}
								>
									{plan.price}
								</span>
								<span
									style={{
										fontFamily: "var(--font-space-mono), monospace",
										fontSize: "0.75rem",
										color: "#6B6B6B",
										marginBottom: 28,
										display: "block",
									}}
								>
									/month
								</span>

								<ul
									style={{
										listStyle: "none",
										padding: 0,
										margin: "0 0 32px 0",
										display: "flex",
										flexDirection: "column",
										gap: 10,
										flex: 1,
									}}
								>
									{plan.features.map((f) => (
										<li
											key={f}
											style={{
												fontFamily: "var(--font-space-mono), monospace",
												fontSize: "0.8rem",
												lineHeight: 1.5,
												display: "flex",
												alignItems: "center",
												gap: 8,
											}}
										>
											<span
												style={{
													width: 8,
													height: 8,
													background: plan.accentColor,
													display: "inline-block",
													flexShrink: 0,
												}}
											/>
											{f}
										</li>
									))}
								</ul>

								<a
									href="#"
									className="btn-konstrukt"
									style={{
										fontFamily: "var(--font-space-mono), monospace",
										fontWeight: 700,
										fontSize: "0.8rem",
										letterSpacing: "0.06em",
										textTransform: "uppercase" as const,
										background: plan.bg === "#F5C518" ? "#0A0A0A" : plan.accentColor,
										color: "#fff",
										border: "3px solid #0A0A0A",
										padding: "14px 24px",
										textDecoration: "none",
										textAlign: "center",
										cursor: "pointer",
										display: "block",
									}}
									onMouseEnter={(e) => {
										const t = e.currentTarget;
										t.style.background = "#FAFAF8";
										t.style.color = "#0A0A0A";
									}}
									onMouseLeave={(e) => {
										const t = e.currentTarget;
										t.style.background = plan.bg === "#F5C518" ? "#0A0A0A" : plan.accentColor;
										t.style.color = "#fff";
									}}
								>
									SELECT PLAN &rarr;
								</a>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/* ─────────────────────────────────────────────
   CTA
   ───────────────────────────────────────────── */
function CTASection() {
	const fade = useFadeIn();

	return (
		<section
			ref={fade.ref}
			className={`fade-section ${fade.visible ? "visible" : ""}`}
			style={{
				background: "#E63320",
				borderBottom: "3px solid #0A0A0A",
				padding: "96px 24px",
				textAlign: "center",
			}}
		>
			<h2
				style={{
					fontFamily: "var(--font-syne), sans-serif",
					fontWeight: 800,
					fontSize: "clamp(2.4rem, 5vw, 4.5rem)",
					color: "#fff",
					letterSpacing: "-0.02em",
					margin: "0 0 36px 0",
				}}
			>
				START AUTOMATING.
			</h2>

			<a
				href="#"
				className="btn-konstrukt"
				style={{
					fontFamily: "var(--font-space-mono), monospace",
					fontWeight: 700,
					fontSize: "1rem",
					letterSpacing: "0.06em",
					textTransform: "uppercase" as const,
					background: "transparent",
					color: "#fff",
					border: "3px solid #fff",
					padding: "16px 48px",
					textDecoration: "none",
					cursor: "pointer",
					display: "inline-block",
				}}
				onMouseEnter={(e) => {
					const t = e.currentTarget;
					t.style.background = "#fff";
					t.style.color = "#E63320";
				}}
				onMouseLeave={(e) => {
					const t = e.currentTarget;
					t.style.background = "transparent";
					t.style.color = "#fff";
				}}
			>
				BEGIN &rarr;
			</a>

			<p
				style={{
					fontFamily: "var(--font-space-mono), monospace",
					fontSize: "0.8rem",
					color: "rgba(255,255,255,0.7)",
					marginTop: 20,
				}}
			>
				No credit card required
			</p>
		</section>
	);
}

/* ─────────────────────────────────────────────
   FOOTER
   ───────────────────────────────────────────── */
function Footer() {
	return (
		<footer
			style={{
				borderTop: "3px solid #0A0A0A",
				background: "#FAFAF8",
			}}
		>
			<div
				style={{
					maxWidth: 1400,
					margin: "0 auto",
					padding: "48px 24px",
					display: "grid",
					gap: 32,
				}}
				className="grid-cols-1 md:grid-cols-[2fr_1fr_1fr]"
			>
				{/* Brand block */}
				<div>
					<div
						style={{
							fontFamily: "var(--font-syne), sans-serif",
							fontWeight: 800,
							fontSize: "clamp(2rem, 3vw, 2.6rem)",
							letterSpacing: "0.12em",
							textTransform: "uppercase" as const,
							marginBottom: 8,
						}}
					>
						AUTO CRON
					</div>
					<div
						style={{
							fontFamily: "var(--font-space-mono), monospace",
							fontSize: "0.85rem",
							color: "#6B6B6B",
						}}
					>
						2025
					</div>
				</div>

				{/* Nav links */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 10,
						fontFamily: "var(--font-space-mono), monospace",
						fontSize: "0.8rem",
						letterSpacing: "0.06em",
						textTransform: "uppercase" as const,
					}}
				>
					{["Features", "Pricing", "Documentation", "Support"].map((link) => (
						<a key={link} href="#" style={{ textDecoration: "none", color: "#0A0A0A" }}>
							{link}
						</a>
					))}
				</div>

				{/* Geometric composition */}
				<div
					style={{
						position: "relative",
						minHeight: 100,
					}}
					className="hidden md:block"
				>
					{/* Yellow circle */}
					<div
						style={{
							position: "absolute",
							top: 0,
							right: 40,
							width: 72,
							height: 72,
							borderRadius: "50%",
							background: "#F5C518",
						}}
					/>
					{/* Blue square */}
					<div
						style={{
							position: "absolute",
							top: 30,
							right: 0,
							width: 56,
							height: 56,
							background: "#2B4AE8",
						}}
					/>
					{/* Red small triangle */}
					<div
						style={{
							position: "absolute",
							bottom: 0,
							right: 80,
							width: 36,
							height: 36,
							background: "#E63320",
							clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
						}}
					/>
				</div>
			</div>

			{/* Bottom bar */}
			<div
				style={{
					borderTop: "3px solid #0A0A0A",
					padding: "16px 24px",
					fontFamily: "var(--font-space-mono), monospace",
					fontSize: "0.7rem",
					color: "#6B6B6B",
					textAlign: "center",
					letterSpacing: "0.04em",
					textTransform: "uppercase" as const,
				}}
			>
				KONSTRUKT DESIGN SYSTEM / AUTO CRON / ALL RIGHTS RESERVED
			</div>
		</footer>
	);
}
