"use client";

import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { useEffect, useRef, useState } from "react";

const jakarta = Plus_Jakarta_Sans({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700", "800"],
	variable: "--font-jakarta",
});

const plexMono = IBM_Plex_Mono({
	subsets: ["latin"],
	weight: ["300", "400"],
	variable: "--font-plex-mono",
});

/* ─────────────────────────── CSS KEYFRAMES ─────────────────────────── */

const keyframes = `
@keyframes auroraFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(60px, -40px) scale(1.1); }
  50% { transform: translate(-30px, 60px) scale(0.95); }
  75% { transform: translate(40px, 30px) scale(1.05); }
}
@keyframes auroraFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-50px, 50px) scale(1.08); }
  50% { transform: translate(40px, -30px) scale(0.92); }
  75% { transform: translate(-60px, -20px) scale(1.04); }
}
@keyframes auroraFloat3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(70px, 40px) scale(1.12); }
  66% { transform: translate(-40px, -50px) scale(0.9); }
}
@keyframes auroraFloat4 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  20% { transform: translate(-30px, -60px) scale(1.06); }
  40% { transform: translate(50px, 20px) scale(0.94); }
  60% { transform: translate(-20px, 40px) scale(1.1); }
  80% { transform: translate(40px, -30px) scale(0.98); }
}
@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes cardFloat {
  0%, 100% { transform: perspective(1000px) rotateX(5deg) rotateY(-5deg) translateY(0px); }
  50% { transform: perspective(1000px) rotateX(5deg) rotateY(-5deg) translateY(-8px); }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 40px rgba(124, 58, 237, 0.3), 0 0 80px rgba(37, 99, 235, 0.15); }
  50% { box-shadow: 0 0 60px rgba(124, 58, 237, 0.5), 0 0 120px rgba(37, 99, 235, 0.25); }
}
@keyframes subtlePulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
`;

/* ─────────────────────────── TYPES ─────────────────────────── */

interface ScheduleItem {
	time: string;
	label: string;
	type: "meeting" | "task" | "habit";
	color: string;
	bgColor: string;
}

/* ─────────────────────────── SCHEDULE DATA ─────────────────────────── */

const scheduleItems: ScheduleItem[] = [
	{
		time: "09:00",
		label: "Team Standup",
		type: "meeting",
		color: "#2563EB",
		bgColor: "rgba(37, 99, 235, 0.15)",
	},
	{
		time: "10:00",
		label: "Deep Work: API Integration",
		type: "task",
		color: "#7C3AED",
		bgColor: "rgba(124, 58, 237, 0.15)",
	},
	{
		time: "12:00",
		label: "Meditation",
		type: "habit",
		color: "#10B981",
		bgColor: "rgba(16, 185, 129, 0.15)",
	},
	{
		time: "14:00",
		label: "Code Review",
		type: "meeting",
		color: "#2563EB",
		bgColor: "rgba(37, 99, 235, 0.15)",
	},
	{
		time: "16:00",
		label: "Exercise",
		type: "habit",
		color: "#10B981",
		bgColor: "rgba(16, 185, 129, 0.15)",
	},
];

/* ─────────────────────────── ANIMATE ON SCROLL HOOK ─────────────────────────── */

function useInView(threshold = 0.15) {
	const ref = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting) {
					setIsVisible(true);
					observer.unobserve(el);
				}
			},
			{ threshold },
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, [threshold]);

	return { ref, isVisible };
}

/* ─────────────────────────── COMPONENTS ─────────────────────────── */

function GlassCard({
	children,
	className = "",
	gradientBorder = false,
	gradient = "linear-gradient(135deg, #7C3AED, #2563EB)",
	style,
}: {
	children: React.ReactNode;
	className?: string;
	gradientBorder?: boolean;
	gradient?: string;
	style?: React.CSSProperties;
}) {
	if (gradientBorder) {
		return (
			<div
				className={className}
				style={{ background: gradient, padding: "1px", borderRadius: "16px", ...style }}
			>
				<div
					style={{
						background: "#0c0c14",
						borderRadius: "15px",
						height: "100%",
					}}
				>
					{children}
				</div>
			</div>
		);
	}

	return (
		<div
			className={className}
			style={{
				background: "rgba(255, 255, 255, 0.05)",
				backdropFilter: "blur(20px)",
				WebkitBackdropFilter: "blur(20px)",
				border: "1px solid rgba(255, 255, 255, 0.1)",
				borderRadius: "16px",
				...style,
			}}
		>
			{children}
		</div>
	);
}

function GradientText({
	children,
	gradient = "linear-gradient(135deg, #7C3AED, #06B6D4)",
	className = "",
	as = "span",
}: {
	children: React.ReactNode;
	gradient?: string;
	className?: string;
	as?: "span" | "div" | "h1" | "h2" | "h3" | "h4" | "p";
}) {
	const Tag = as;
	return (
		<Tag
			className={className}
			style={{
				background: gradient,
				WebkitBackgroundClip: "text",
				WebkitTextFillColor: "transparent",
				backgroundClip: "text",
			}}
		>
			{children}
		</Tag>
	);
}

function AnimatedSection({
	children,
	className = "",
	delay = 0,
}: { children: React.ReactNode; className?: string; delay?: number }) {
	const { ref, isVisible } = useInView(0.1);

	return (
		<div
			ref={ref}
			className={className}
			style={{
				opacity: isVisible ? 1 : 0,
				transform: isVisible ? "translateY(0)" : "translateY(30px)",
				transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
			}}
		>
			{children}
		</div>
	);
}

/* ─────────────────────────── SECTION: NAV ─────────────────────────── */

function Nav() {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const handler = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", handler, { passive: true });
		return () => window.removeEventListener("scroll", handler);
	}, []);

	return (
		<nav
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				zIndex: 100,
				transition: "all 0.3s ease",
			}}
		>
			<div
				style={{
					maxWidth: "1200px",
					margin: "12px auto 0",
					padding: "0 24px",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "12px 24px",
						borderRadius: "9999px",
						background: scrolled ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.03)",
						backdropFilter: "blur(24px)",
						WebkitBackdropFilter: "blur(24px)",
						border: `1px solid ${scrolled ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.06)"}`,
						transition: "all 0.3s ease",
					}}
				>
					{/* Logo */}
					<GradientText
						className={jakarta.className}
						gradient="linear-gradient(135deg, #7C3AED, #06B6D4)"
						as="div"
					>
						<span style={{ fontWeight: 700, fontSize: "1.125rem", letterSpacing: "-0.02em" }}>
							auto cron
						</span>
					</GradientText>

					{/* Links - hidden on mobile */}
					<div
						style={{
							display: "flex",
							gap: "32px",
							alignItems: "center",
						}}
						className="nav-links"
					>
						{["Features", "How It Works", "Pricing"].map((item) => (
							<a
								key={item}
								href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
								className={jakarta.className}
								style={{
									color: "#94A3B8",
									fontSize: "0.875rem",
									fontWeight: 500,
									textDecoration: "none",
									transition: "color 0.2s ease",
								}}
								onMouseEnter={(e) => (e.currentTarget.style.color = "#F8FAFC")}
								onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
							>
								{item}
							</a>
						))}
					</div>

					{/* CTA */}
					<a
						href="#pricing"
						className={jakarta.className}
						style={{
							background: "linear-gradient(135deg, #7C3AED, #2563EB)",
							color: "#F8FAFC",
							padding: "8px 20px",
							borderRadius: "9999px",
							fontSize: "0.875rem",
							fontWeight: 600,
							textDecoration: "none",
							transition: "all 0.2s ease",
							boxShadow: "0 0 20px rgba(124, 58, 237, 0.3)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.boxShadow = "0 0 30px rgba(124, 58, 237, 0.5)";
							e.currentTarget.style.transform = "translateY(-1px)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.boxShadow = "0 0 20px rgba(124, 58, 237, 0.3)";
							e.currentTarget.style.transform = "translateY(0)";
						}}
					>
						Get Started
					</a>
				</div>
			</div>
		</nav>
	);
}

/* ─────────────────────────── SECTION: HERO ─────────────────────────── */

function Hero() {
	return (
		<section
			style={{
				minHeight: "100vh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "140px 24px 80px",
				position: "relative",
				textAlign: "center",
			}}
		>
			{/* Shimmer badge */}
			<AnimatedSection>
				<div
					className={jakarta.className}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: "8px",
						padding: "6px 16px",
						borderRadius: "9999px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						background: "rgba(255, 255, 255, 0.05)",
						fontSize: "0.8125rem",
						fontWeight: 500,
						color: "#94A3B8",
						marginBottom: "32px",
						overflow: "hidden",
						position: "relative",
					}}
				>
					<span
						style={{
							position: "absolute",
							inset: 0,
							background:
								"linear-gradient(90deg, transparent, rgba(124, 58, 237, 0.2), rgba(6, 182, 212, 0.2), transparent)",
							backgroundSize: "200% 100%",
							animation: "shimmer 3s linear infinite",
						}}
					/>
					<span
						style={{
							width: "6px",
							height: "6px",
							borderRadius: "50%",
							background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
							animation: "subtlePulse 2s ease infinite",
						}}
					/>
					<span style={{ position: "relative", zIndex: 1 }}>Intelligent Scheduling Engine</span>
				</div>
			</AnimatedSection>

			{/* Headline */}
			<AnimatedSection delay={0.1}>
				<h1
					className={jakarta.className}
					style={{
						fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
						fontWeight: 800,
						color: "#F8FAFC",
						lineHeight: 1.05,
						letterSpacing: "-0.03em",
						marginBottom: "24px",
						maxWidth: "900px",
					}}
				>
					Your schedule,
					<br />
					<GradientText gradient="linear-gradient(135deg, #7C3AED, #2563EB, #06B6D4)">
						on autopilot.
					</GradientText>
				</h1>
			</AnimatedSection>

			{/* Subtext */}
			<AnimatedSection delay={0.2}>
				<p
					className={jakarta.className}
					style={{
						fontSize: "clamp(1rem, 2vw, 1.2rem)",
						fontWeight: 400,
						color: "#94A3B8",
						lineHeight: 1.7,
						maxWidth: "640px",
						marginBottom: "40px",
					}}
				>
					Auto Cron&apos;s priority-based algorithm orchestrates your tasks, habits, and calendar
					events into the perfect schedule. Connect Google Calendar. Set your priorities. Let the
					engine run.
				</p>
			</AnimatedSection>

			{/* CTAs */}
			<AnimatedSection delay={0.3}>
				<div
					style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}
				>
					<a
						href="#pricing"
						className={jakarta.className}
						style={{
							background: "linear-gradient(135deg, #7C3AED, #2563EB)",
							color: "#F8FAFC",
							padding: "14px 36px",
							borderRadius: "9999px",
							fontSize: "1rem",
							fontWeight: 600,
							textDecoration: "none",
							transition: "all 0.3s ease",
							boxShadow: "0 0 40px rgba(124, 58, 237, 0.35), 0 8px 32px rgba(0, 0, 0, 0.3)",
							display: "inline-block",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.boxShadow =
								"0 0 60px rgba(124, 58, 237, 0.5), 0 8px 40px rgba(0, 0, 0, 0.4)";
							e.currentTarget.style.transform = "translateY(-2px)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.boxShadow =
								"0 0 40px rgba(124, 58, 237, 0.35), 0 8px 32px rgba(0, 0, 0, 0.3)";
							e.currentTarget.style.transform = "translateY(0)";
						}}
					>
						Start for free &rarr;
					</a>
					<a
						href="#how-it-works"
						className={jakarta.className}
						style={{
							color: "#94A3B8",
							fontSize: "0.875rem",
							fontWeight: 500,
							textDecoration: "none",
							transition: "color 0.2s ease",
						}}
						onMouseEnter={(e) => (e.currentTarget.style.color = "#F8FAFC")}
						onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
					>
						See how it works &darr;
					</a>
				</div>
			</AnimatedSection>

			{/* Floating schedule card */}
			<AnimatedSection delay={0.5}>
				<div
					style={{
						marginTop: "64px",
						width: "100%",
						maxWidth: "480px",
						animation: "cardFloat 6s ease-in-out infinite",
					}}
				>
					<div
						style={{
							background:
								"linear-gradient(135deg, rgba(124, 58, 237, 0.5), rgba(37, 99, 235, 0.5), rgba(6, 182, 212, 0.5))",
							padding: "1px",
							borderRadius: "20px",
						}}
					>
						<div
							style={{
								background: "rgba(12, 12, 20, 0.95)",
								backdropFilter: "blur(40px)",
								WebkitBackdropFilter: "blur(40px)",
								borderRadius: "19px",
								padding: "24px",
							}}
						>
							{/* Card header */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									marginBottom: "20px",
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
									<div
										style={{
											width: "8px",
											height: "8px",
											borderRadius: "50%",
											background: "linear-gradient(135deg, #7C3AED, #2563EB)",
										}}
									/>
									<span
										className={jakarta.className}
										style={{ color: "#F8FAFC", fontSize: "0.875rem", fontWeight: 600 }}
									>
										Today&apos;s Schedule
									</span>
								</div>
								<span
									className={plexMono.className}
									style={{ color: "#94A3B8", fontSize: "0.75rem" }}
								>
									Auto-generated
								</span>
							</div>

							{/* Schedule items */}
							<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
								{scheduleItems.map((item, i) => (
									<div
										key={i}
										style={{
											display: "flex",
											alignItems: "center",
											gap: "12px",
											padding: "10px 12px",
											background: item.bgColor,
											borderRadius: "10px",
											borderLeft: `3px solid ${item.color}`,
											transition: "all 0.2s ease",
										}}
									>
										<span
											className={plexMono.className}
											style={{ color: "#94A3B8", fontSize: "0.75rem", minWidth: "40px" }}
										>
											{item.time}
										</span>
										<span
											className={jakarta.className}
											style={{ color: "#F8FAFC", fontSize: "0.8125rem", fontWeight: 500, flex: 1 }}
										>
											{item.label}
										</span>
										<span
											className={jakarta.className}
											style={{
												color: item.color,
												fontSize: "0.6875rem",
												fontWeight: 600,
												textTransform: "uppercase",
												letterSpacing: "0.05em",
											}}
										>
											{item.type}
										</span>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</AnimatedSection>
		</section>
	);
}

/* ─────────────────────────── SECTION: FEATURES ─────────────────────────── */

function Features() {
	const features = [
		{
			title: "Priority Intelligence",
			description:
				"Five priority levels from gentle nudge to critical blocker. The algorithm weighs urgency \u00d7 priority to find the optimal slot.",
			gradient: "linear-gradient(135deg, #7C3AED, #a855f7)",
			icon: (
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
				</svg>
			),
		},
		{
			title: "Habit Autopilot",
			description:
				"Daily meditation. Weekly reviews. Monthly planning. Set your rhythms and Auto Cron places them in preferred time windows.",
			gradient: "linear-gradient(135deg, #06B6D4, #10B981)",
			icon: (
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
					<path d="M9 12l2 2 4-4" />
				</svg>
			),
		},
		{
			title: "Calendar Fusion",
			description:
				"Bidirectional Google Calendar sync. Your events flow in, scheduled items flow out. Always in harmony.",
			gradient: "linear-gradient(135deg, #2563EB, #06B6D4)",
			icon: (
				<svg
					width="24"
					height="24"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
					<line x1="16" y1="2" x2="16" y2="6" />
					<line x1="8" y1="2" x2="8" y2="6" />
					<line x1="3" y1="10" x2="21" y2="10" />
				</svg>
			),
		},
	];

	return (
		<section id="features" style={{ padding: "100px 24px", maxWidth: "1200px", margin: "0 auto" }}>
			<AnimatedSection>
				<div style={{ textAlign: "center", marginBottom: "64px" }}>
					<GradientText
						as="h2"
						className={jakarta.className}
						gradient="linear-gradient(135deg, #7C3AED, #06B6D4)"
					>
						<span
							style={{
								fontSize: "clamp(2rem, 4vw, 3rem)",
								fontWeight: 800,
								letterSpacing: "-0.02em",
							}}
						>
							Built for flow
						</span>
					</GradientText>
					<p
						className={jakarta.className}
						style={{ color: "#94A3B8", fontSize: "1.125rem", marginTop: "16px", fontWeight: 400 }}
					>
						Every feature designed to keep you in your zone.
					</p>
				</div>
			</AnimatedSection>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
					gap: "24px",
				}}
			>
				{features.map((feature, i) => (
					<AnimatedSection key={i} delay={i * 0.15}>
						<div
							style={{
								background: feature.gradient,
								padding: "1px",
								borderRadius: "16px",
								height: "100%",
								transition: "transform 0.3s ease, box-shadow 0.3s ease",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.transform = "translateY(-4px)";
								e.currentTarget.style.boxShadow = "0 20px 60px rgba(0, 0, 0, 0.3)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.transform = "translateY(0)";
								e.currentTarget.style.boxShadow = "none";
							}}
						>
							<div
								style={{
									background: "#0c0c14",
									borderRadius: "15px",
									padding: "32px",
									height: "100%",
									display: "flex",
									flexDirection: "column",
								}}
							>
								{/* Icon */}
								<div
									style={{
										width: "48px",
										height: "48px",
										borderRadius: "12px",
										background: feature.gradient,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										color: "#F8FAFC",
										marginBottom: "20px",
									}}
								>
									{feature.icon}
								</div>

								<h3
									className={jakarta.className}
									style={{
										color: "#F8FAFC",
										fontSize: "1.25rem",
										fontWeight: 700,
										marginBottom: "12px",
										letterSpacing: "-0.01em",
									}}
								>
									{feature.title}
								</h3>
								<p
									className={jakarta.className}
									style={{
										color: "#94A3B8",
										fontSize: "0.9375rem",
										lineHeight: 1.7,
										fontWeight: 400,
									}}
								>
									{feature.description}
								</p>
							</div>
						</div>
					</AnimatedSection>
				))}
			</div>
		</section>
	);
}

/* ─────────────────────────── SECTION: THE ENGINE ─────────────────────────── */

function Engine() {
	const bullets = [
		"Sorts by deadline urgency \u00d7 priority weight",
		"Greedy solver fills earliest available slots",
		"Respects working hours and buffer times",
		"Auto-reschedules on any change",
		"75-day forward planning horizon",
	];

	const codeLines: { text: string; color: string }[][] = [
		[
			{ text: "for ", color: "#7C3AED" },
			{ text: "task ", color: "#F8FAFC" },
			{ text: "in ", color: "#7C3AED" },
			{ text: "sorted", color: "#06B6D4" },
			{ text: "(tasks, key=", color: "#F8FAFC" },
			{ text: "urgency\u00d7weight", color: "#F59E0B" },
			{ text: "):", color: "#F8FAFC" },
		],
		[
			{ text: "  slot = ", color: "#F8FAFC" },
			{ text: "find_earliest_slot", color: "#06B6D4" },
			{ text: "(", color: "#F8FAFC" },
		],
		[
			{ text: "    after=", color: "#F59E0B" },
			{ text: "now", color: "#F8FAFC" },
			{ text: ",", color: "#94A3B8" },
		],
		[
			{ text: "    duration=", color: "#F59E0B" },
			{ text: "task.estimate", color: "#F8FAFC" },
			{ text: ",", color: "#94A3B8" },
		],
		[
			{ text: "    within=", color: "#F59E0B" },
			{ text: "working_hours", color: "#F8FAFC" },
		],
		[{ text: "  )", color: "#F8FAFC" }],
		[
			{ text: "  if ", color: "#7C3AED" },
			{ text: "slot.", color: "#F8FAFC" },
			{ text: "conflicts", color: "#06B6D4" },
			{ text: "(existing):", color: "#F8FAFC" },
		],
		[
			{ text: "    slot = ", color: "#F8FAFC" },
			{ text: "resolve_conflict", color: "#06B6D4" },
			{ text: "(slot)", color: "#F8FAFC" },
		],
		[
			{ text: "  schedule.", color: "#F8FAFC" },
			{ text: "assign", color: "#06B6D4" },
			{ text: "(task, slot)", color: "#F8FAFC" },
		],
	];

	return (
		<section
			id="how-it-works"
			style={{
				padding: "120px 24px",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Subtle grid background */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					backgroundImage:
						"linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
					backgroundSize: "60px 60px",
					maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
					WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
				}}
			/>

			<div
				style={{
					maxWidth: "1200px",
					margin: "0 auto",
					display: "grid",
					gridTemplateColumns: "1fr",
					gap: "48px",
					position: "relative",
				}}
				className="engine-grid"
			>
				{/* Left: Text */}
				<AnimatedSection>
					<div>
						<GradientText
							as="h2"
							className={jakarta.className}
							gradient="linear-gradient(135deg, #7C3AED, #06B6D4)"
						>
							<span
								style={{
									fontSize: "clamp(2rem, 4vw, 3rem)",
									fontWeight: 800,
									letterSpacing: "-0.02em",
									display: "block",
									marginBottom: "24px",
								}}
							>
								The Scheduling Engine
							</span>
						</GradientText>
						<p
							className={plexMono.className}
							style={{
								color: "#94A3B8",
								fontSize: "0.875rem",
								lineHeight: 1.8,
								maxWidth: "500px",
								marginBottom: "32px",
							}}
						>
							A deterministic algorithm that runs in milliseconds. Every time you add, move, or
							complete a task, the engine re-evaluates your entire schedule to find the optimal
							arrangement.
						</p>

						<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
							{bullets.map((bullet, i) => (
								<div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
									<div
										style={{
											width: "6px",
											height: "6px",
											borderRadius: "50%",
											background: "linear-gradient(135deg, #7C3AED, #06B6D4)",
											flexShrink: 0,
										}}
									/>
									<span
										className={plexMono.className}
										style={{ color: "#F8FAFC", fontSize: "0.875rem" }}
									>
										{bullet}
									</span>
								</div>
							))}
						</div>
					</div>
				</AnimatedSection>

				{/* Right: Code */}
				<AnimatedSection delay={0.2}>
					<div
						style={{
							background:
								"linear-gradient(135deg, rgba(124, 58, 237, 0.4), rgba(6, 182, 212, 0.4))",
							padding: "1px",
							borderRadius: "16px",
						}}
					>
						<div
							style={{
								background: "rgba(12, 12, 20, 0.95)",
								backdropFilter: "blur(40px)",
								WebkitBackdropFilter: "blur(40px)",
								borderRadius: "15px",
								padding: "28px",
								overflow: "auto",
							}}
						>
							{/* Window chrome */}
							<div style={{ display: "flex", gap: "6px", marginBottom: "20px" }}>
								<div
									style={{
										width: "10px",
										height: "10px",
										borderRadius: "50%",
										background: "#EF4444",
										opacity: 0.7,
									}}
								/>
								<div
									style={{
										width: "10px",
										height: "10px",
										borderRadius: "50%",
										background: "#F59E0B",
										opacity: 0.7,
									}}
								/>
								<div
									style={{
										width: "10px",
										height: "10px",
										borderRadius: "50%",
										background: "#10B981",
										opacity: 0.7,
									}}
								/>
							</div>

							{/* Code lines */}
							<pre
								className={plexMono.className}
								style={{ fontSize: "0.8125rem", lineHeight: 1.9, margin: 0 }}
							>
								{codeLines.map((line, i) => (
									<div key={i}>
										{line.map((segment, j) => (
											<span key={j} style={{ color: segment.color }}>
												{segment.text}
											</span>
										))}
									</div>
								))}
							</pre>
						</div>
					</div>
				</AnimatedSection>
			</div>
		</section>
	);
}

/* ─────────────────────────── SECTION: STATS ─────────────────────────── */

function Stats() {
	const stats = [
		{ value: "5", label: "Priority Levels", gradient: "linear-gradient(135deg, #7C3AED, #a855f7)" },
		{ value: "75", label: "Day Horizon", gradient: "linear-gradient(135deg, #2563EB, #06B6D4)" },
		{
			value: "\u221e",
			label: "Scheduling Runs",
			gradient: "linear-gradient(135deg, #06B6D4, #10B981)",
		},
		{
			value: "< 1s",
			label: "Computation Time",
			gradient: "linear-gradient(135deg, #EC4899, #F59E0B)",
		},
	];

	return (
		<section style={{ padding: "80px 24px", maxWidth: "1200px", margin: "0 auto" }}>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
					gap: "20px",
				}}
			>
				{stats.map((stat, i) => (
					<AnimatedSection key={i} delay={i * 0.1}>
						<GlassCard style={{ padding: "32px 24px", textAlign: "center" }}>
							<GradientText as="div" className={jakarta.className} gradient={stat.gradient}>
								<span style={{ fontSize: "3rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
									{stat.value}
								</span>
							</GradientText>
							<p
								className={jakarta.className}
								style={{
									color: "#94A3B8",
									fontSize: "0.875rem",
									fontWeight: 500,
									marginTop: "8px",
								}}
							>
								{stat.label}
							</p>
						</GlassCard>
					</AnimatedSection>
				))}
			</div>
		</section>
	);
}

/* ─────────────────────────── SECTION: PRICING ─────────────────────────── */

function Pricing() {
	const plans = [
		{
			name: "Basic",
			price: "\u20ac5",
			period: "/month",
			features: ["50 tasks", "5 habits", "100 scheduling runs", "Google Calendar sync"],
			highlighted: false,
			badge: null,
		},
		{
			name: "Pro",
			price: "\u20ac8",
			period: "/month",
			features: ["200 tasks", "20 habits", "500 scheduling runs", "Google Calendar sync"],
			highlighted: true,
			badge: "Popular",
		},
		{
			name: "Premium",
			price: "\u20ac16",
			period: "/month",
			features: [
				"Unlimited tasks",
				"Unlimited habits",
				"Unlimited runs",
				"Google Calendar sync",
				"Analytics dashboard",
			],
			highlighted: false,
			badge: null,
		},
	];

	return (
		<section id="pricing" style={{ padding: "120px 24px", maxWidth: "1100px", margin: "0 auto" }}>
			<AnimatedSection>
				<div style={{ textAlign: "center", marginBottom: "64px" }}>
					<GradientText
						as="h2"
						className={jakarta.className}
						gradient="linear-gradient(135deg, #7C3AED, #06B6D4)"
					>
						<span
							style={{
								fontSize: "clamp(2rem, 4vw, 3rem)",
								fontWeight: 800,
								letterSpacing: "-0.02em",
							}}
						>
							Simple pricing
						</span>
					</GradientText>
					<p
						className={jakarta.className}
						style={{ color: "#94A3B8", fontSize: "1.125rem", marginTop: "12px", fontWeight: 400 }}
					>
						for ambitious schedules
					</p>
				</div>
			</AnimatedSection>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
					gap: "24px",
					alignItems: "start",
				}}
			>
				{plans.map((plan, i) => (
					<AnimatedSection key={i} delay={i * 0.15}>
						<div
							style={{
								position: "relative",
								transition: "transform 0.3s ease",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.transform = "translateY(-4px)";
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.transform = "translateY(0)";
							}}
						>
							{/* Glow behind highlighted */}
							{plan.highlighted && (
								<div
									style={{
										position: "absolute",
										inset: "-2px",
										borderRadius: "18px",
										background: "linear-gradient(135deg, #7C3AED, #2563EB)",
										filter: "blur(20px)",
										opacity: 0.3,
										animation: "glowPulse 4s ease infinite",
										zIndex: -1,
									}}
								/>
							)}

							<div
								style={{
									background: plan.highlighted
										? "linear-gradient(135deg, #7C3AED, #2563EB)"
										: "transparent",
									padding: "1px",
									borderRadius: "16px",
								}}
							>
								<div
									style={{
										background: plan.highlighted ? "#0c0c14" : "rgba(255, 255, 255, 0.05)",
										backdropFilter: plan.highlighted ? "none" : "blur(20px)",
										WebkitBackdropFilter: plan.highlighted ? "none" : "blur(20px)",
										border: plan.highlighted ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
										borderRadius: plan.highlighted ? "15px" : "16px",
										padding: "32px",
									}}
								>
									{/* Badge */}
									{plan.badge && (
										<div
											className={jakarta.className}
											style={{
												display: "inline-block",
												background: "linear-gradient(135deg, #7C3AED, #2563EB)",
												color: "#F8FAFC",
												padding: "4px 12px",
												borderRadius: "9999px",
												fontSize: "0.75rem",
												fontWeight: 600,
												marginBottom: "16px",
											}}
										>
											{plan.badge}
										</div>
									)}

									<h3
										className={jakarta.className}
										style={{
											color: "#F8FAFC",
											fontSize: "1.25rem",
											fontWeight: 700,
											marginBottom: "8px",
										}}
									>
										{plan.name}
									</h3>

									<div style={{ marginBottom: "24px" }}>
										<span
											className={jakarta.className}
											style={{
												color: "#F8FAFC",
												fontSize: "2.5rem",
												fontWeight: 800,
												letterSpacing: "-0.02em",
											}}
										>
											{plan.price}
										</span>
										<span
											className={jakarta.className}
											style={{ color: "#94A3B8", fontSize: "0.9375rem", fontWeight: 400 }}
										>
											{plan.period}
										</span>
									</div>

									{/* Features */}
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "12px",
											marginBottom: "28px",
										}}
									>
										{plan.features.map((feature, j) => (
											<div key={j} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
												<svg
													width="16"
													height="16"
													viewBox="0 0 16 16"
													fill="none"
													style={{ flexShrink: 0 }}
												>
													<path
														d="M13.5 4.5L6.5 11.5L2.5 7.5"
														stroke="#06B6D4"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
													/>
												</svg>
												<span
													className={jakarta.className}
													style={{ color: "#94A3B8", fontSize: "0.875rem", fontWeight: 400 }}
												>
													{feature}
												</span>
											</div>
										))}
									</div>

									{/* Button */}
									<a
										href="#"
										className={jakarta.className}
										style={{
											display: "block",
											textAlign: "center",
											padding: "12px 24px",
											borderRadius: "9999px",
											fontWeight: 600,
											fontSize: "0.9375rem",
											textDecoration: "none",
											transition: "all 0.2s ease",
											...(plan.highlighted
												? {
														background: "linear-gradient(135deg, #7C3AED, #2563EB)",
														color: "#F8FAFC",
														boxShadow: "0 0 30px rgba(124, 58, 237, 0.3)",
													}
												: {
														background: "rgba(255, 255, 255, 0.08)",
														border: "1px solid rgba(255, 255, 255, 0.1)",
														color: "#F8FAFC",
													}),
										}}
										onMouseEnter={(e) => {
											if (plan.highlighted) {
												e.currentTarget.style.boxShadow = "0 0 40px rgba(124, 58, 237, 0.5)";
											} else {
												e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
											}
										}}
										onMouseLeave={(e) => {
											if (plan.highlighted) {
												e.currentTarget.style.boxShadow = "0 0 30px rgba(124, 58, 237, 0.3)";
											} else {
												e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
											}
										}}
									>
										Get started
									</a>
								</div>
							</div>
						</div>
					</AnimatedSection>
				))}
			</div>
		</section>
	);
}

/* ─────────────────────────── SECTION: FINAL CTA ─────────────────────────── */

function FinalCTA() {
	return (
		<section
			style={{
				padding: "120px 24px",
				textAlign: "center",
				position: "relative",
			}}
		>
			{/* Intense glow orb */}
			<div
				style={{
					position: "absolute",
					top: "50%",
					left: "50%",
					transform: "translate(-50%, -50%)",
					width: "500px",
					height: "500px",
					background: "radial-gradient(circle, rgba(124, 58, 237, 0.25), transparent 70%)",
					filter: "blur(80px)",
					pointerEvents: "none",
				}}
			/>

			<AnimatedSection>
				<div style={{ position: "relative" }}>
					<h2
						className={jakarta.className}
						style={{
							fontSize: "clamp(2.5rem, 5vw, 4rem)",
							fontWeight: 800,
							color: "#F8FAFC",
							letterSpacing: "-0.03em",
							marginBottom: "24px",
						}}
					>
						Ready to automate?
					</h2>
					<p
						className={jakarta.className}
						style={{
							color: "#94A3B8",
							fontSize: "1.125rem",
							marginBottom: "40px",
							fontWeight: 400,
						}}
					>
						No credit card required. Set up in 2 minutes.
					</p>
					<a
						href="#pricing"
						className={jakarta.className}
						style={{
							display: "inline-block",
							background: "linear-gradient(135deg, #7C3AED, #2563EB)",
							color: "#F8FAFC",
							padding: "16px 48px",
							borderRadius: "9999px",
							fontSize: "1.125rem",
							fontWeight: 700,
							textDecoration: "none",
							transition: "all 0.3s ease",
							boxShadow: "0 0 50px rgba(124, 58, 237, 0.4), 0 8px 40px rgba(0, 0, 0, 0.3)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.boxShadow =
								"0 0 80px rgba(124, 58, 237, 0.6), 0 8px 50px rgba(0, 0, 0, 0.4)";
							e.currentTarget.style.transform = "translateY(-2px)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.boxShadow =
								"0 0 50px rgba(124, 58, 237, 0.4), 0 8px 40px rgba(0, 0, 0, 0.3)";
							e.currentTarget.style.transform = "translateY(0)";
						}}
					>
						Start for free &rarr;
					</a>
				</div>
			</AnimatedSection>
		</section>
	);
}

/* ─────────────────────────── SECTION: FOOTER ─────────────────────────── */

function Footer() {
	return (
		<footer
			style={{
				padding: "32px 24px",
				borderTop: "1px solid rgba(255, 255, 255, 0.06)",
			}}
		>
			<div
				style={{
					maxWidth: "1200px",
					margin: "0 auto",
					display: "flex",
					flexWrap: "wrap",
					justifyContent: "space-between",
					alignItems: "center",
					gap: "16px",
				}}
			>
				<GradientText
					className={jakarta.className}
					gradient="linear-gradient(135deg, #7C3AED, #06B6D4)"
				>
					<span style={{ fontWeight: 700, fontSize: "1rem" }}>auto cron</span>
				</GradientText>

				<div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
					{["Privacy", "Terms", "Contact"].map((link) => (
						<a
							key={link}
							href="#"
							className={jakarta.className}
							style={{
								color: "#94A3B8",
								fontSize: "0.8125rem",
								textDecoration: "none",
								fontWeight: 400,
								transition: "color 0.2s ease",
							}}
							onMouseEnter={(e) => (e.currentTarget.style.color = "#F8FAFC")}
							onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
						>
							{link}
						</a>
					))}
				</div>

				<p
					className={jakarta.className}
					style={{ color: "#64748B", fontSize: "0.8125rem", fontWeight: 400 }}
				>
					&copy; {new Date().getFullYear()} Auto Cron. All rights reserved.
				</p>
			</div>
		</footer>
	);
}

/* ─────────────────────────── MAIN PAGE ─────────────────────────── */

export default function LandingPage() {
	return (
		<>
			{/* Inject keyframes */}
			<style dangerouslySetInnerHTML={{ __html: keyframes }} />

			{/* Responsive styles */}
			<style
				dangerouslySetInnerHTML={{
					__html: `
            .nav-links {
              display: none !important;
            }
            @media (min-width: 768px) {
              .nav-links {
                display: flex !important;
              }
              .engine-grid {
                grid-template-columns: 1fr 1fr !important;
                align-items: center;
              }
            }
            /* Override the parent layout's bg */
            html, body {
              scrollbar-width: thin;
              scrollbar-color: rgba(124, 58, 237, 0.3) transparent;
            }
            ::-webkit-scrollbar {
              width: 6px;
            }
            ::-webkit-scrollbar-track {
              background: transparent;
            }
            ::-webkit-scrollbar-thumb {
              background: rgba(124, 58, 237, 0.3);
              border-radius: 3px;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: rgba(124, 58, 237, 0.5);
            }
            /* Smooth scroll */
            html {
              scroll-behavior: smooth;
            }
          `,
				}}
			/>

			<div
				className={`${jakarta.variable} ${plexMono.variable}`}
				style={{
					background: "#08080C",
					color: "#F8FAFC",
					minHeight: "100vh",
					position: "relative",
					overflow: "hidden",
				}}
			>
				{/* ─── Aurora Background Orbs ─── */}
				<div
					style={{
						position: "fixed",
						inset: 0,
						zIndex: 0,
						pointerEvents: "none",
						overflow: "hidden",
					}}
				>
					{/* Purple orb — top right */}
					<div
						style={{
							position: "absolute",
							top: "-10%",
							right: "-5%",
							width: "700px",
							height: "700px",
							borderRadius: "50%",
							background: "radial-gradient(circle, rgba(124, 58, 237, 0.35), transparent 70%)",
							filter: "blur(150px)",
							animation: "auroraFloat1 25s ease-in-out infinite",
						}}
					/>
					{/* Cyan orb — bottom left */}
					<div
						style={{
							position: "absolute",
							bottom: "-15%",
							left: "-10%",
							width: "800px",
							height: "800px",
							borderRadius: "50%",
							background: "radial-gradient(circle, rgba(6, 182, 212, 0.25), transparent 70%)",
							filter: "blur(180px)",
							animation: "auroraFloat2 30s ease-in-out infinite",
						}}
					/>
					{/* Pink orb — center */}
					<div
						style={{
							position: "absolute",
							top: "40%",
							left: "30%",
							width: "600px",
							height: "600px",
							borderRadius: "50%",
							background: "radial-gradient(circle, rgba(236, 72, 153, 0.2), transparent 70%)",
							filter: "blur(160px)",
							animation: "auroraFloat3 22s ease-in-out infinite",
						}}
					/>
					{/* Blue accent orb — mid right */}
					<div
						style={{
							position: "absolute",
							top: "60%",
							right: "10%",
							width: "500px",
							height: "500px",
							borderRadius: "50%",
							background: "radial-gradient(circle, rgba(37, 99, 235, 0.2), transparent 70%)",
							filter: "blur(140px)",
							animation: "auroraFloat4 28s ease-in-out infinite",
						}}
					/>
				</div>

				{/* ─── Content ─── */}
				<div style={{ position: "relative", zIndex: 1 }}>
					<Nav />
					<Hero />
					<Features />
					<Engine />
					<Stats />
					<Pricing />
					<FinalCTA />
					<Footer />
				</div>
			</div>
		</>
	);
}
