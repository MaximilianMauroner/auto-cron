"use client";

import { Cormorant_Garamond, Crimson_Pro } from "next/font/google";
import { useEffect, useRef, useState } from "react";

const cormorant = Cormorant_Garamond({
	subsets: ["latin"],
	weight: ["300", "400", "600", "700"],
	variable: "--font-cormorant",
	display: "swap",
});

const crimson = Crimson_Pro({
	subsets: ["latin"],
	weight: ["300", "400", "500"],
	variable: "--font-crimson",
	display: "swap",
});

/* ──────────────────────────── data ──────────────────────────── */

const features = [
	{
		title: "Task Orchestration",
		desc: "Priority-weighted scheduling across five levels. From backlog to queue to calendar — every task finds its moment.",
	},
	{
		title: "Habit Architecture",
		desc: "Daily, weekly, monthly rhythms placed precisely in your preferred time windows. Consistency, engineered.",
	},
	{
		title: "Calendar Fusion",
		desc: "Bidirectional Google Calendar sync. Your events, meetings, and commitments — unified in a single source of truth.",
	},
	{
		title: "Working Hours",
		desc: "Respects your boundaries. Scheduling only when you\u2019re available, preserving the hours that belong to you.",
	},
	{
		title: "Smart Rescheduling",
		desc: "Automatic reflow when priorities shift or events change. The schedule adapts; you don\u2019t.",
	},
	{
		title: "Schedule Horizon",
		desc: "Plan up to 75 days ahead with algorithmic precision. See the shape of your future, composed in advance.",
	},
];

const steps = [
	{
		num: "01",
		title: "Define",
		desc: "Set your tasks, habits, and priorities. Tell the system what matters.",
	},
	{
		num: "02",
		title: "Calibrate",
		desc: "Configure working hours, preferred windows, and scheduling constraints.",
	},
	{
		num: "03",
		title: "Compose",
		desc: "The algorithm orchestrates your optimal schedule with surgical precision.",
	},
	{
		num: "04",
		title: "Flow",
		desc: "Live your composed day. When things shift, the system recomposes in real time.",
	},
];

const pricing = [
	{
		name: "Essentials",
		price: "5",
		period: "/month",
		highlight: false,
		features: [
			"50 active tasks",
			"5 recurring habits",
			"100 scheduling runs",
			"Google Calendar sync",
			"5 priority levels",
		],
	},
	{
		name: "Professional",
		price: "8",
		period: "/month",
		highlight: true,
		features: [
			"200 active tasks",
			"20 recurring habits",
			"500 scheduling runs",
			"Google Calendar sync",
			"Smart rescheduling",
			"Priority support",
		],
	},
	{
		name: "Atelier",
		price: "16",
		period: "/month",
		highlight: false,
		features: [
			"Unlimited tasks",
			"Unlimited habits",
			"Unlimited scheduling",
			"Google Calendar sync",
			"Advanced analytics",
			"75-day horizon",
			"Dedicated support",
		],
	},
];

/* ──────────────────────── animation hook ─────────────────────── */

function useFadeIn(threshold = 0.15) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const io = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (entry?.isIntersecting) {
					setVisible(true);
					io.unobserve(el);
				}
			},
			{ threshold },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [threshold]);

	return { ref, visible };
}

function FadeIn({
	children,
	delay = 0,
	className = "",
}: {
	children: React.ReactNode;
	delay?: number;
	className?: string;
}) {
	const { ref, visible } = useFadeIn();
	return (
		<div
			ref={ref}
			className={className}
			style={{
				opacity: visible ? 1 : 0,
				transform: visible ? "translateY(0)" : "translateY(32px)",
				transition: `opacity 0.9s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s, transform 0.9s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}s`,
			}}
		>
			{children}
		</div>
	);
}

/* ─────────────────────── page component ─────────────────────── */

export default function LandingPage() {
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 40);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<div
			className={`${cormorant.variable} ${crimson.variable} relative min-h-screen`}
			style={{ backgroundColor: "#080808", color: "#F5F0E8" }}
		>
			{/* ── Global animations ── */}
			<style jsx global>{`
        @keyframes goldLineExpand {
          0% {
            width: 0;
          }
          100% {
            width: 180px;
          }
        }
        @keyframes fadeInUp {
          0% {
            opacity: 0;
            transform: translateY(40px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes grainShift {
          0%,
          100% {
            transform: translate(0, 0);
          }
          10% {
            transform: translate(-2%, -2%);
          }
          20% {
            transform: translate(1%, 3%);
          }
          30% {
            transform: translate(-3%, 1%);
          }
          40% {
            transform: translate(3%, -1%);
          }
          50% {
            transform: translate(-1%, 2%);
          }
          60% {
            transform: translate(2%, -3%);
          }
          70% {
            transform: translate(-2%, 1%);
          }
          80% {
            transform: translate(1%, -2%);
          }
          90% {
            transform: translate(-1%, 3%);
          }
        }
        .grain-overlay {
          position: fixed;
          inset: -50%;
          width: 200%;
          height: 200%;
          pointer-events: none;
          z-index: 9999;
          opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");
          background-size: 256px 256px;
          animation: grainShift 0.5s steps(6) infinite;
        }
        .font-display {
          font-family: var(--font-cormorant), "Georgia", serif;
        }
        .font-body {
          font-family: var(--font-crimson), "Georgia", serif;
        }
        .gold-line {
          animation: goldLineExpand 1.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)
            0.6s forwards;
        }
        .hero-animate {
          animation: fadeInUp 1s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
          opacity: 0;
        }
        .hero-d1 {
          animation-delay: 0.2s;
        }
        .hero-d2 {
          animation-delay: 0.45s;
        }
        .hero-d3 {
          animation-delay: 0.7s;
        }
        .hero-d4 {
          animation-delay: 0.95s;
        }
        .hero-d5 {
          animation-delay: 1.2s;
        }
        /* Custom scrollbar for horizontal scroll */
        .horizontal-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .horizontal-scroll::-webkit-scrollbar-track {
          background: #111111;
        }
        .horizontal-scroll::-webkit-scrollbar-thumb {
          background: #c9a96e;
          border-radius: 2px;
        }
        .horizontal-scroll {
          scrollbar-width: thin;
          scrollbar-color: #c9a96e #111111;
        }
        /* Feature card hover */
        .feature-card {
          border-left: 1px solid #c9a96e;
          border-top: 1px solid transparent;
          border-right: 1px solid transparent;
          border-bottom: 1px solid transparent;
          transition: all 0.4s ease;
        }
        .feature-card:hover {
          border-color: #c9a96e;
        }
        /* Pricing glow */
        .pricing-glow {
          box-shadow: 0 0 60px rgba(201, 169, 110, 0.08),
            0 0 120px rgba(201, 169, 110, 0.04);
        }
        /* Step card */
        .step-card {
          transition: all 0.4s ease;
        }
        .step-card:hover {
          background-color: #161616;
        }
      `}</style>

			{/* ── Grain overlay ── */}
			<div className="grain-overlay" />

			{/* ═══════════════════ NAVIGATION ═══════════════════ */}
			<nav
				className="fixed top-0 right-0 left-0 z-50 transition-all duration-500"
				style={{
					backgroundColor: scrolled ? "rgba(8,8,8,0.92)" : "transparent",
					backdropFilter: scrolled ? "blur(12px)" : "none",
					borderBottom: scrolled ? "1px solid #1A1A1A" : "1px solid transparent",
				}}
			>
				<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-12">
					<a
						href="#"
						className="font-display text-2xl leading-none font-light italic tracking-wide"
						style={{ color: "#C9A96E" }}
					>
						Auto Cron
					</a>
					<div className="font-body flex items-center gap-8 text-sm font-light tracking-wide">
						<a
							href="#features"
							className="hidden transition-colors duration-300 hover:opacity-80 sm:inline"
							style={{ color: "#8A8478" }}
						>
							Features
						</a>
						<a
							href="#pricing"
							className="hidden transition-colors duration-300 hover:opacity-80 sm:inline"
							style={{ color: "#8A8478" }}
						>
							Pricing
						</a>
						<a href="#" className="transition-colors duration-300" style={{ color: "#C9A96E" }}>
							Sign In
						</a>
					</div>
				</div>
			</nav>

			{/* ═══════════════════ HERO ═══════════════════ */}
			<section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-32 text-center">
				{/* label */}
				<p
					className="hero-animate hero-d1 font-body mb-8 text-xs font-medium tracking-[0.35em] uppercase"
					style={{ color: "#C9A96E" }}
				>
					Intelligent Scheduling
				</p>

				{/* headline */}
				<h1
					className="hero-animate hero-d2 font-display mx-auto max-w-5xl text-5xl leading-[1.1] font-light md:text-6xl lg:text-7xl xl:text-[5.5rem]"
					style={{ color: "#F5F0E8" }}
				>
					Your time deserves
					<br />
					better than chaos.
				</h1>

				{/* gold expanding line */}
				<div className="my-10 flex justify-center">
					<div className="gold-line h-[1px] w-0" style={{ backgroundColor: "#C9A96E" }} />
				</div>

				{/* subhead */}
				<p
					className="hero-animate hero-d3 font-body mx-auto max-w-2xl text-lg leading-relaxed font-light md:text-xl"
					style={{ color: "#8A8478" }}
				>
					Auto Cron orchestrates your tasks, habits, and calendar with surgical precision. The
					algorithm thinks so you don&rsquo;t have to.
				</p>

				{/* buttons */}
				<div className="hero-animate hero-d4 mt-12 flex flex-wrap items-center justify-center gap-5">
					<a
						href="#"
						className="font-body inline-block rounded-none px-10 py-3.5 text-sm font-medium tracking-widest uppercase transition-all duration-300"
						style={{ backgroundColor: "#C9A96E", color: "#080808" }}
						onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D4B97F")}
						onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C9A96E")}
					>
						Begin
					</a>
					<a
						href="#how"
						className="font-body inline-block rounded-none border px-10 py-3.5 text-sm font-medium tracking-widest uppercase transition-all duration-300"
						style={{ borderColor: "#C9A96E", color: "#C9A96E" }}
						onMouseEnter={(e) => {
							e.currentTarget.style.backgroundColor = "rgba(201,169,110,0.08)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.backgroundColor = "transparent";
						}}
					>
						See How It Works
					</a>
				</div>
			</section>

			{/* ═══════════════════ THE PHILOSOPHY ═══════════════════ */}
			<section className="relative px-6 py-32 lg:px-12">
				<div className="mx-auto grid max-w-7xl gap-16 md:grid-cols-5">
					{/* left 60% */}
					<div className="md:col-span-3">
						<FadeIn>
							<blockquote
								className="font-display text-4xl leading-snug font-light italic md:text-5xl lg:text-6xl"
								style={{ color: "#F5F0E8" }}
							>
								&ldquo;We don&rsquo;t manage time.
								<br />
								We compose it.&rdquo;
							</blockquote>
						</FadeIn>
					</div>

					{/* right 40% */}
					<div className="flex flex-col gap-10 md:col-span-2">
						{/* gold divider */}
						<FadeIn delay={0.15}>
							<div className="h-[1px] w-16" style={{ backgroundColor: "#C9A96E" }} />
						</FadeIn>

						<FadeIn delay={0.25}>
							<div>
								<h3
									className="font-body mb-3 text-xs font-medium tracking-[0.3em] uppercase"
									style={{ color: "#C9A96E" }}
								>
									Priority-Based Intelligence
								</h3>
								<p
									className="font-body text-base leading-relaxed font-light"
									style={{ color: "#8A8478" }}
								>
									Five priority levels &mdash; from low to blocker &mdash; govern the algorithmic
									placement of every task. What matters most always comes first.
								</p>
							</div>
						</FadeIn>

						<FadeIn delay={0.4}>
							<div>
								<h3
									className="font-body mb-3 text-xs font-medium tracking-[0.3em] uppercase"
									style={{ color: "#C9A96E" }}
								>
									Habitual Precision
								</h3>
								<p
									className="font-body text-base leading-relaxed font-light"
									style={{ color: "#8A8478" }}
								>
									Your habits are scheduled within your preferred time windows &mdash; morning,
									afternoon, evening. Rhythms honoured, not forced.
								</p>
							</div>
						</FadeIn>

						<FadeIn delay={0.55}>
							<div>
								<h3
									className="font-body mb-3 text-xs font-medium tracking-[0.3em] uppercase"
									style={{ color: "#C9A96E" }}
								>
									Calendar Harmony
								</h3>
								<p
									className="font-body text-base leading-relaxed font-light"
									style={{ color: "#8A8478" }}
								>
									Bidirectional Google Calendar sync means your events and scheduled tasks live in
									one unified timeline. No context switching.
								</p>
							</div>
						</FadeIn>
					</div>
				</div>
			</section>

			{/* ═══════════════════ FEATURES GRID ═══════════════════ */}
			<section id="features" className="relative px-6 py-32 lg:px-12">
				<div className="mx-auto max-w-7xl">
					<FadeIn>
						<p
							className="font-body mb-4 text-xs font-medium tracking-[0.35em] uppercase"
							style={{ color: "#C9A96E" }}
						>
							The Instruments
						</p>
						<div className="mb-20 h-[1px] w-12" style={{ backgroundColor: "#C9A96E" }} />
					</FadeIn>

					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{features.map((f, i) => (
							<FadeIn key={f.title} delay={i * 0.1}>
								<div className="feature-card p-8 lg:p-10" style={{ backgroundColor: "#111111" }}>
									<h3
										className="font-display mb-4 text-2xl font-light"
										style={{ color: "#F5F0E8" }}
									>
										{f.title}
									</h3>
									<p
										className="font-body text-sm leading-relaxed font-light"
										style={{ color: "#8A8478" }}
									>
										{f.desc}
									</p>
								</div>
							</FadeIn>
						))}
					</div>
				</div>
			</section>

			{/* ═══════════════════ HOW IT COMPOSES ═══════════════════ */}
			<section id="how" className="relative py-32">
				<div className="mx-auto max-w-7xl px-6 lg:px-12">
					<FadeIn>
						<p
							className="font-body mb-4 text-xs font-medium tracking-[0.35em] uppercase"
							style={{ color: "#C9A96E" }}
						>
							How It Composes
						</p>
						<div className="mb-16 h-[1px] w-12" style={{ backgroundColor: "#C9A96E" }} />
					</FadeIn>
				</div>

				<FadeIn>
					<div className="horizontal-scroll flex gap-6 overflow-x-auto px-6 pb-6 lg:px-12">
						{steps.map((s) => (
							<div
								key={s.num}
								className="step-card flex min-w-[320px] flex-shrink-0 flex-col justify-between border p-10 md:min-w-[380px]"
								style={{
									backgroundColor: "#111111",
									borderColor: "#1A1A1A",
								}}
							>
								<div>
									<span
										className="font-display mb-6 block text-6xl font-light"
										style={{ color: "#C9A96E" }}
									>
										{s.num}
									</span>
									<h3
										className="font-display mb-4 text-3xl font-light"
										style={{ color: "#F5F0E8" }}
									>
										{s.title}
									</h3>
								</div>
								<p
									className="font-body mt-6 text-sm leading-relaxed font-light"
									style={{ color: "#8A8478" }}
								>
									{s.desc}
								</p>
							</div>
						))}
						{/* spacer for last card padding */}
						<div className="min-w-[1px] flex-shrink-0" />
					</div>
				</FadeIn>
			</section>

			{/* ═══════════════════ PRICING ═══════════════════ */}
			<section id="pricing" className="relative px-6 py-32 lg:px-12">
				<div className="mx-auto max-w-7xl">
					<FadeIn>
						<p
							className="font-body mb-4 text-center text-xs font-medium tracking-[0.35em] uppercase"
							style={{ color: "#C9A96E" }}
						>
							Your Investment
						</p>
						<div className="mx-auto mb-20 h-[1px] w-12" style={{ backgroundColor: "#C9A96E" }} />
					</FadeIn>

					<div className="grid gap-6 md:grid-cols-3">
						{pricing.map((plan, i) => (
							<FadeIn key={plan.name} delay={i * 0.12}>
								<div
									className={`flex h-full flex-col border p-10 transition-all duration-400 lg:p-12 ${plan.highlight ? "pricing-glow" : ""}`}
									style={{
										backgroundColor: "#111111",
										borderColor: plan.highlight ? "#C9A96E" : "#1A1A1A",
									}}
								>
									{/* plan label */}
									<p
										className="font-body mb-8 text-xs font-medium tracking-[0.3em] uppercase"
										style={{ color: plan.highlight ? "#C9A96E" : "#8A8478" }}
									>
										{plan.name}
									</p>

									{/* price */}
									<div className="mb-10 flex items-baseline gap-1">
										<span className="font-display text-lg font-light" style={{ color: "#8A8478" }}>
											&euro;
										</span>
										<span
											className="font-display text-6xl leading-none font-light lg:text-7xl"
											style={{ color: "#F5F0E8" }}
										>
											{plan.price}
										</span>
										<span
											className="font-body ml-1 text-sm font-light"
											style={{ color: "#8A8478" }}
										>
											{plan.period}
										</span>
									</div>

									{/* divider */}
									<div
										className="mb-8 h-[1px] w-full"
										style={{
											backgroundColor: plan.highlight ? "#C9A96E" : "#1A1A1A",
											opacity: plan.highlight ? 0.4 : 1,
										}}
									/>

									{/* features list */}
									<ul className="mb-10 flex flex-col gap-3.5">
										{plan.features.map((feat) => (
											<li
												key={feat}
												className="font-body flex items-start gap-3 text-sm font-light"
												style={{ color: "#8A8478" }}
											>
												<span
													className="mt-1.5 block h-1.5 w-1.5 flex-shrink-0 rounded-full"
													style={{ backgroundColor: "#C9A96E" }}
												/>
												{feat}
											</li>
										))}
									</ul>

									{/* CTA */}
									<div className="mt-auto">
										<a
											href="#"
											className="font-body block w-full py-3.5 text-center text-sm font-medium tracking-widest uppercase transition-all duration-300"
											style={{
												backgroundColor: plan.highlight ? "#C9A96E" : "transparent",
												color: plan.highlight ? "#080808" : "#C9A96E",
												border: plan.highlight ? "1px solid #C9A96E" : "1px solid #C9A96E",
											}}
											onMouseEnter={(e) => {
												if (plan.highlight) {
													e.currentTarget.style.backgroundColor = "#D4B97F";
												} else {
													e.currentTarget.style.backgroundColor = "rgba(201,169,110,0.08)";
												}
											}}
											onMouseLeave={(e) => {
												if (plan.highlight) {
													e.currentTarget.style.backgroundColor = "#C9A96E";
												} else {
													e.currentTarget.style.backgroundColor = "transparent";
												}
											}}
										>
											{plan.highlight ? "Begin Now" : "Choose Plan"}
										</a>
									</div>
								</div>
							</FadeIn>
						))}
					</div>
				</div>
			</section>

			{/* ═══════════════════ FINAL CTA ═══════════════════ */}
			<section className="relative px-6 py-40 text-center lg:px-12">
				<FadeIn>
					<h2
						className="font-display mb-12 text-5xl font-light md:text-7xl lg:text-8xl"
						style={{ color: "#F5F0E8" }}
					>
						Time, composed.
					</h2>
				</FadeIn>

				<FadeIn delay={0.2}>
					<a
						href="#"
						className="font-body inline-block rounded-none px-14 py-4 text-sm font-medium tracking-widest uppercase transition-all duration-300"
						style={{ backgroundColor: "#C9A96E", color: "#080808" }}
						onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D4B97F")}
						onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C9A96E")}
					>
						Begin Your Composition
					</a>
				</FadeIn>

				<FadeIn delay={0.35}>
					<p
						className="font-body mt-8 text-sm font-light tracking-wide"
						style={{ color: "#8A8478" }}
					>
						No credit card required
					</p>
				</FadeIn>
			</section>

			{/* ═══════════════════ FOOTER ═══════════════════ */}
			<footer className="border-t px-6 py-10 text-center" style={{ borderColor: "#1A1A1A" }}>
				<p className="font-body text-xs font-light tracking-widest" style={{ color: "#C9A96E" }}>
					&copy; 2025 Auto Cron &mdash; Time, composed.
				</p>
			</footer>
		</div>
	);
}
