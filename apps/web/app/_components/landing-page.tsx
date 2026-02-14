"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";

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
		name: "Free",
		price: "0",
		features: ["28 tasks / month", "1-week horizon", "Google Calendar sync"],
		highlight: false,
	},
	{
		name: "Basic",
		price: "4.99",
		features: ["100 tasks / month", "10 habits", "4-week horizon", "Google Calendar sync"],
		highlight: false,
	},
	{
		name: "Plus",
		price: "7.99",
		features: [
			"Unlimited tasks & habits",
			"8-week horizon",
			"Analytics dashboard",
			"Google Calendar sync",
		],
		highlight: true,
	},
	{
		name: "Pro",
		price: "15.99",
		features: ["Everything in Plus", "12-week horizon", "Priority support"],
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
	logoHref?: string;
}

export function LandingPage({ logoHref = "/" }: LandingPageProps) {
	const spotlightRef = useRef<HTMLDivElement>(null);
	const heroWatermarkRef = useRef<HTMLDivElement>(null);

	const revealCallback = useCallback((entries: IntersectionObserverEntry[]) => {
		for (const entry of entries) {
			if (entry.isIntersecting) {
				(entry.target as HTMLElement).classList.add("revealed");
			}
		}
	}, []);

	useEffect(() => {
		const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		const observer = new IntersectionObserver(revealCallback, {
			threshold: 0.08,
			rootMargin: "0px 0px -40px 0px",
		});

		const elements = document.querySelectorAll("[data-reveal]");
		for (const el of elements) {
			if (prefersReduced) {
				(el as HTMLElement).classList.add("revealed");
			} else {
				observer.observe(el);
			}
		}

		if (prefersReduced) return () => observer.disconnect();

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
			observer.disconnect();
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("scroll", handleScroll);
		};
	}, [revealCallback]);

	return (
		<div className="bg-lp-parchment text-lp-navy font-[family-name:var(--font-outfit)] text-base leading-[1.65] antialiased overflow-x-hidden">
			{/* SVG Grain */}
			<svg
				className="fixed inset-0 w-full h-full pointer-events-none z-[9998] opacity-[0.032]"
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

			<div className="swiss-page relative z-[1] pb-14">
				{/* Mouse spotlight */}
				<div ref={spotlightRef} className="lp-spotlight" aria-hidden="true" />

				{/* ═══ NAVIGATION ═══ */}
				<nav
					className="lp-hero-nav sticky top-0 z-[100] bg-lp-parchment/[0.91] backdrop-blur-[12px]"
					aria-label="Main navigation"
				>
					<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
						<div className="flex items-center justify-between h-[72px]">
							<a
								href={logoHref}
								aria-label="Auto Cron home"
								className="font-[family-name:var(--font-outfit)] font-extrabold text-lg tracking-[0.08em] no-underline text-lp-navy uppercase flex items-center gap-2.5"
							>
								<Image
									src="/logo.png"
									alt="Auto Cron logo"
									width={28}
									height={28}
									className="size-7 rounded-md"
									priority
								/>
								Auto&nbsp;Cron
							</a>

							<div className="lp-nav-desktop flex gap-8 items-center">
								{["Features", "Process", "Pricing"].map((item) => (
									<a key={item} href={`#${item.toLowerCase()}`} className="lp-nav-link">
										{item}
									</a>
								))}
								<a href="/sign-in" className="lp-nav-link opacity-60 hover:opacity-100">
									Log in
								</a>
								<a href="#cta" className="lp-btn-gold !py-2.5 !px-7 !text-[11px]">
									Get Started
								</a>
							</div>
						</div>
					</div>
					<hr className="lp-rule-thick" />
				</nav>

				{/* ═══ HERO ═══ */}
				<section className="relative py-[clamp(80px,14vh,200px)] pb-[clamp(60px,10vh,140px)] overflow-hidden">
					<div
						className="lp-rotated-label"
						style={{ left: "clamp(12px, 2vw, 40px)", top: "200px" }}
						aria-hidden="true"
					>
						Since 2025
					</div>

					{/* Parallax watermark */}
					<div
						ref={heroWatermarkRef}
						aria-hidden="true"
						className="absolute -right-[3%] -top-[10%] font-[family-name:var(--font-bebas)] text-[clamp(24rem,50vw,60rem)] leading-[0.8] opacity-[0.025] text-lp-navy pointer-events-none select-none z-0 will-change-transform"
					>
						AC
					</div>

					<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
						<div className="grid grid-cols-[1fr_auto] gap-[clamp(32px,4vw,80px)] items-center">
							{/* Left: Content */}
							<div>
								<h1 className="lp-hero-title font-[family-name:var(--font-bebas)] text-[clamp(7rem,17vw,18rem)] leading-[0.9] tracking-[-0.01em] uppercase m-0">
									<span className="lp-hero-line-1 block">Auto</span>
									<span className="lp-hero-line-2 block">Cron</span>
								</h1>

								<div
									className="lp-hero-gold-rule h-[3px] w-[clamp(120px,22vw,300px)] mt-[clamp(24px,3vw,44px)]"
									aria-hidden="true"
									style={{
										background:
											"linear-gradient(90deg, var(--lp-gold), color-mix(in srgb, var(--lp-gold) 19%, transparent))",
									}}
								/>

								<div className="lp-hero-tagline mt-[clamp(24px,3vw,44px)] max-w-[580px]">
									<p className="font-[family-name:var(--font-outfit)] text-[clamp(1.05rem,1.6vw,1.25rem)] leading-[1.75] text-lp-navy opacity-70">
										Intelligent auto-scheduling that orchestrates your tasks, habits, and calendar
										events through a{" "}
										<span className="text-lp-gold font-bold border-b-2 border-lp-gold/25">
											priority-based
										</span>{" "}
										algorithm.
									</p>
								</div>

								<div className="lp-hero-cta mt-[clamp(32px,4vw,56px)] flex items-center gap-5 flex-wrap">
									<a href="#cta" className="lp-btn-gold">
										Start Scheduling
									</a>
									<a href="#features" className="lp-btn-outline">
										Learn More
									</a>
								</div>
							</div>

							{/* Right: Abstract Schedule Grid */}
							<div
								className="lp-hero-grid-viz w-[clamp(200px,24vw,340px)] relative"
								aria-hidden="true"
							>
								<svg viewBox="0 0 280 400" fill="none" className="w-full h-auto opacity-85">
									{/* Column lines */}
									{Array.from({ length: 6 }, (_, i) => (
										<line
											key={`col-${i}`}
											x1={i * 56}
											y1="0"
											x2={i * 56}
											y2="400"
											stroke="var(--lp-navy)"
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
											stroke="var(--lp-navy)"
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
											fill="var(--lp-gold)"
											opacity={0.15 + idx * 0.06}
											style={{
												animation: `lp-gridPulse ${3 + idx * 0.7}s ease-in-out ${idx * 0.3}s infinite`,
											}}
										/>
									))}
									{/* Corner markers */}
									<line x1="0" y1="0" x2="16" y2="0" stroke="var(--lp-gold)" strokeWidth="2" />
									<line x1="0" y1="0" x2="0" y2="16" stroke="var(--lp-gold)" strokeWidth="2" />
									<line x1="280" y1="0" x2="264" y2="0" stroke="var(--lp-gold)" strokeWidth="2" />
									<line x1="280" y1="0" x2="280" y2="16" stroke="var(--lp-gold)" strokeWidth="2" />
									<line x1="0" y1="400" x2="16" y2="400" stroke="var(--lp-gold)" strokeWidth="2" />
									<line x1="0" y1="400" x2="0" y2="384" stroke="var(--lp-gold)" strokeWidth="2" />
									<line
										x1="280"
										y1="400"
										x2="264"
										y2="400"
										stroke="var(--lp-gold)"
										strokeWidth="2"
									/>
									<line
										x1="280"
										y1="400"
										x2="280"
										y2="384"
										stroke="var(--lp-gold)"
										strokeWidth="2"
									/>
									{/* Day labels */}
									{["M", "T", "W", "T", "F"].map((d, i) => (
										<text
											key={d + i}
											x={i * 56 + 28}
											y="395"
											textAnchor="middle"
											fill="var(--lp-navy)"
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

				<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
					<hr className="lp-rule-thick lp-reg-mark" />
				</div>

				{/* ═══ MANIFESTO — Section 01 ═══ */}
				<section id="manifesto" className="py-[clamp(80px,10vh,160px)] relative">
					<div
						className="lp-rotated-label"
						style={{ left: "clamp(12px, 2vw, 40px)", top: "180px" }}
						aria-hidden="true"
					>
						Manifesto
					</div>

					<div
						className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]"
						data-reveal
					>
						<div className="lp-manifesto-grid grid grid-cols-[1fr_2fr] gap-[clamp(32px,6vw,100px)] items-start">
							<div>
								<span
									className="font-[family-name:var(--font-bebas)] text-lp-gold text-[clamp(6rem,12vw,12rem)] leading-[0.85] block"
									aria-hidden="true"
									style={{
										textShadow: "0 0 80px color-mix(in srgb, var(--lp-gold) 12%, transparent)",
									}}
								>
									01
								</span>
							</div>

							<div>
								{/* Decorative quote mark */}
								<div
									aria-hidden="true"
									className="font-[family-name:var(--font-bebas)] text-[clamp(4rem,8vw,8rem)] leading-[0.5] text-lp-gold opacity-15 -mb-3 -ml-2 select-none"
								>
									{"\u201C"}
								</div>

								<h2 className="font-[family-name:var(--font-outfit)] text-[clamp(1.6rem,3.2vw,2.8rem)] font-bold leading-[1.2] mb-[clamp(20px,3vw,40px)] max-w-[620px]">
									Your calendar is not a plan.
									<br />
									It is a{" "}
									<span className="text-lp-gold relative">
										{"\u201C"}record{"\u201D"}
										<span
											aria-hidden="true"
											className="absolute bottom-[-2px] left-0 right-0 h-[3px] bg-lp-gold/25"
										/>
									</span>{" "}
									of compromises.
								</h2>

								<div className="max-w-[520px] text-[15px] leading-[1.85] opacity-65">
									<p className="mb-[1.2em]">
										Most people schedule reactively. A meeting appears, you work around it. A
										deadline approaches, you panic-block time. Your habits drift. Your priorities
										dissolve into the noise of an overcrowded week.
									</p>
									<p className="mb-[1.2em]">
										Auto&nbsp;Cron inverts this pattern. You declare what matters&nbsp;&mdash; the
										algorithm does the rest. It reads your calendar, respects your constraints,
										understands your energy, and produces a schedule that is mathematically
										optimized for what you actually want to accomplish.
									</p>
									<p>
										This is not a to-do list. This is not another calendar app. This is a scheduling
										engine built on the premise that your time deserves the same rigor as a
										production deployment pipeline.
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
					<hr className="lp-rule-thick lp-reg-mark" />
				</div>

				{/* ═══ FEATURES — Section 02 ═══ */}
				<section id="features" className="py-[clamp(80px,10vh,160px)] relative">
					<div
						className="lp-rotated-label"
						style={{ left: "clamp(12px, 2vw, 40px)", top: "180px" }}
						aria-hidden="true"
					>
						Features
					</div>

					<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
						<div data-reveal className="mb-[clamp(40px,5vw,72px)]">
							<span
								className="font-[family-name:var(--font-bebas)] text-lp-gold text-[clamp(5rem,10vw,10rem)] leading-[0.85] block mb-3"
								aria-hidden="true"
								style={{
									textShadow: "0 0 60px color-mix(in srgb, var(--lp-gold) 9%, transparent)",
								}}
							>
								02
							</span>
							<h2 className="font-[family-name:var(--font-outfit)] text-[clamp(1.3rem,2.2vw,2rem)] font-bold uppercase tracking-[0.06em]">
								Capabilities
							</h2>
						</div>

						{FEATURES.map((feature, idx) => (
							<div key={feature.num}>
								<hr className="lp-rule-thick" style={{ opacity: idx === 0 ? 1 : 0.15 }} />
								<div
									className="lp-feat-row lp-feature-row-inner grid grid-cols-[80px_1fr_1.4fr] gap-[clamp(16px,3vw,48px)] py-[clamp(28px,3.5vw,48px)] items-baseline"
									data-reveal
									style={{ transitionDelay: `${idx * 0.07}s` }}
								>
									<div className="lp-feature-num-col flex justify-end">
										<span className="lp-feat-num font-[family-name:var(--font-bebas)] text-[clamp(2.2rem,4vw,3.8rem)] leading-none opacity-[0.12] transition-[color,opacity] duration-400">
											{feature.num}
										</span>
									</div>

									<h3 className="lp-feat-name font-[family-name:var(--font-outfit)] text-[clamp(1.05rem,1.6vw,1.3rem)] font-bold leading-[1.3] tracking-[0.01em] transition-colors duration-400">
										{idx === 0 && (
											<span className="text-lp-gold">{feature.name.split(" ")[0]}</span>
										)}
										{idx === 0 ? ` ${feature.name.split(" ").slice(1).join(" ")}` : feature.name}
									</h3>

									<p className="text-[14.5px] leading-[1.8] max-w-[480px] opacity-55">
										{feature.desc}
									</p>
								</div>
								{idx === FEATURES.length - 1 && <hr className="lp-rule-thick opacity-15" />}
							</div>
						))}
					</div>
				</section>

				<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
					<hr className="lp-rule-thick lp-reg-mark" />
				</div>

				{/* ═══ PROCESS — Section 03 ═══ */}
				<section id="process" className="py-[clamp(80px,10vh,160px)] relative">
					<div
						className="lp-rotated-label"
						style={{ left: "clamp(12px, 2vw, 40px)", top: "180px" }}
						aria-hidden="true"
					>
						Process
					</div>

					<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
						<div data-reveal className="mb-[clamp(40px,5vw,72px)]">
							<span
								className="font-[family-name:var(--font-bebas)] text-lp-gold text-[clamp(5rem,10vw,10rem)] leading-[0.85] block mb-3"
								aria-hidden="true"
								style={{
									textShadow: "0 0 60px color-mix(in srgb, var(--lp-gold) 9%, transparent)",
								}}
							>
								03
							</span>
							<h2 className="font-[family-name:var(--font-outfit)] text-[clamp(1.3rem,2.2vw,2rem)] font-bold uppercase tracking-[0.06em]">
								How It Works
							</h2>
						</div>

						{/* Timeline connector line */}
						<div data-reveal className="grid relative">
							{/* Horizontal connector */}
							<div
								className="lp-proc-connector absolute top-5 left-[12.5%] right-[12.5%] h-px z-[1]"
								aria-hidden="true"
								style={{
									background:
										"linear-gradient(90deg, color-mix(in srgb, var(--lp-gold) 38%, transparent), var(--lp-gold), var(--lp-gold), color-mix(in srgb, var(--lp-gold) 38%, transparent))",
								}}
							/>

							<div className="lp-process-grid grid grid-cols-4 gap-[clamp(12px,2vw,24px)]">
								{STEPS.map((step, idx) => (
									<div
										key={step.num}
										className="lp-proc-step relative px-[clamp(8px,1vw,20px)] text-center"
									>
										{/* Node dot */}
										<div className="lp-proc-node w-10 h-10 rounded-full border-2 border-lp-navy bg-lp-parchment mx-auto mb-8 flex items-center justify-center relative z-[2] transition-[background,border-color] duration-400">
											<div className="lp-proc-node-dot w-2 h-2 rounded-full bg-lp-gold transition-colors duration-400" />
										</div>

										{/* Ghost number */}
										<div
											aria-hidden="true"
											className="font-[family-name:var(--font-bebas)] text-[clamp(6rem,10vw,10rem)] leading-[0.75] opacity-[0.03] text-lp-navy pointer-events-none select-none -mb-10"
										>
											{step.num}
										</div>

										<span className="font-[family-name:var(--font-cutive)] text-[10px] tracking-[0.2em] uppercase opacity-35 block mb-3">
											Step {step.num}
										</span>

										<h3 className="font-[family-name:var(--font-outfit)] text-[clamp(1.15rem,1.8vw,1.5rem)] font-bold leading-[1.2] mb-3.5">
											{idx === 2 ? <span className="text-lp-gold">{step.title}</span> : step.title}
										</h3>

										<p className="text-sm leading-[1.75] max-w-[260px] mx-auto opacity-55">
											{step.text}
										</p>
									</div>
								))}
							</div>
						</div>
					</div>
				</section>

				<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
					<hr className="lp-rule-thick lp-reg-mark" />
				</div>

				{/* ═══ PRICING — Section 04 ═══ */}
				<section id="pricing" className="py-[clamp(80px,10vh,160px)] relative">
					<div
						className="lp-rotated-label"
						style={{ left: "clamp(12px, 2vw, 40px)", top: "180px" }}
						aria-hidden="true"
					>
						Pricing
					</div>

					<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
						<div data-reveal className="mb-[clamp(40px,5vw,72px)]">
							<span
								className="font-[family-name:var(--font-bebas)] text-lp-gold text-[clamp(5rem,10vw,10rem)] leading-[0.85] block mb-3"
								aria-hidden="true"
								style={{
									textShadow: "0 0 60px color-mix(in srgb, var(--lp-gold) 9%, transparent)",
								}}
							>
								04
							</span>
							<h2 className="font-[family-name:var(--font-outfit)] text-[clamp(1.3rem,2.2vw,2rem)] font-bold uppercase tracking-[0.06em]">
								Plans
							</h2>
						</div>

						<div
							className="lp-pricing-grid grid grid-cols-2 md:grid-cols-4 gap-[clamp(16px,2vw,28px)] items-start"
							data-reveal
						>
							{PLANS.map((plan) => (
								<div
									key={plan.name}
									className={`lp-pricing-card ${plan.highlight ? "lp-pricing-card-pro" : ""} relative overflow-hidden`}
									style={{
										border: plan.highlight
											? "2px solid var(--lp-gold)"
											: "1.5px solid color-mix(in srgb, var(--lp-navy) 9%, transparent)",
										background: plan.highlight
											? "linear-gradient(180deg, color-mix(in srgb, var(--lp-gold) 3%, transparent), var(--lp-parchment))"
											: "var(--lp-parchment)",
									}}
								>
									{/* Pro badge */}
									{plan.highlight && (
										<div className="bg-lp-gold text-lp-navy font-[family-name:var(--font-outfit)] font-bold text-[10px] tracking-[0.15em] uppercase text-center py-2">
											Most Popular
										</div>
									)}

									{/* Header */}
									<div
										className="p-[clamp(28px,3vw,40px)] px-[clamp(24px,2.5vw,36px)]"
										style={{
											borderBottom: `1px solid ${plan.highlight ? "color-mix(in srgb, var(--lp-gold) 19%, transparent)" : "color-mix(in srgb, var(--lp-navy) 6%, transparent)"}`,
										}}
									>
										<h3
											className={`font-[family-name:var(--font-outfit)] text-[clamp(0.95rem,1.3vw,1.15rem)] font-bold tracking-[0.08em] uppercase mb-3 ${plan.highlight ? "text-lp-gold" : "text-lp-navy"}`}
										>
											{plan.name}
										</h3>
										<div className="flex items-baseline gap-1.5">
											<span className="font-[family-name:var(--font-bebas)] text-[clamp(3rem,5.5vw,4.5rem)] leading-none tabular-nums">
												{plan.price}
											</span>
											<div>
												<span className="text-base font-semibold opacity-60">EUR</span>
												<span className="font-[family-name:var(--font-cutive)] block text-[11px] opacity-35 mt-0.5">
													/month
												</span>
											</div>
										</div>
									</div>

									{/* Features */}
									<div className="p-[clamp(20px,2vw,32px)] px-[clamp(24px,2.5vw,36px)]">
										<ul className="list-none m-0 p-0">
											{plan.features.map((feat, i) => (
												<li
													key={feat}
													className="flex items-start gap-3 py-2.5 text-sm opacity-65"
													style={{
														borderBottom:
															i < plan.features.length - 1
																? "1px solid color-mix(in srgb, var(--lp-navy) 3%, transparent)"
																: "none",
													}}
												>
													<span
														aria-hidden="true"
														className={`text-xs leading-5 shrink-0 font-bold ${plan.highlight ? "text-lp-gold" : "text-lp-warm"}`}
													>
														+
													</span>
													{feat}
												</li>
											))}
										</ul>
									</div>

									{/* CTA */}
									<div className="px-[clamp(24px,2.5vw,36px)] pb-[clamp(28px,3vw,40px)]">
										{plan.highlight ? (
											<a href="#cta" className="lp-btn-gold w-full text-center block">
												Choose {plan.name}
											</a>
										) : (
											<a href="#cta" className="lp-pricing-link w-full text-center">
												Choose {plan.name}
											</a>
										)}
									</div>
								</div>
							))}
						</div>

						<p
							data-reveal
							className="font-[family-name:var(--font-cutive)] mt-7 text-[10px] tracking-[0.12em] uppercase opacity-25"
						>
							All prices in EUR. Billed monthly. Cancel anytime.
						</p>
					</div>
				</section>

				{/* ═══ CTA — Dark Section ═══ */}
				<section
					id="cta"
					className="bg-lp-navy relative overflow-hidden py-[clamp(100px,16vh,240px)]"
				>
					{/* Geometric decorations */}
					<div
						aria-hidden="true"
						className="absolute left-1/2 top-1/2 w-[clamp(400px,60vw,800px)] h-[clamp(400px,60vw,800px)] rounded-full pointer-events-none z-0"
						style={{
							background:
								"radial-gradient(circle, color-mix(in srgb, var(--lp-gold) 7%, transparent), transparent 70%)",
							animation: "lp-glowPulse 6s ease-in-out infinite",
						}}
					/>

					{/* Background ghost text */}
					<div
						aria-hidden="true"
						className="absolute -right-[4%] top-1/2 -translate-y-1/2 font-[family-name:var(--font-bebas)] text-[clamp(18rem,35vw,50rem)] leading-none opacity-[0.04] text-lp-parchment pointer-events-none select-none"
					>
						GO
					</div>

					{/* Subtle grid in dark section */}
					<div
						aria-hidden="true"
						className="absolute inset-0 pointer-events-none"
						style={{
							backgroundImage:
								"linear-gradient(color-mix(in srgb, var(--lp-parchment) 2%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--lp-parchment) 2%, transparent) 1px, transparent 1px)",
							backgroundSize: "60px 60px",
						}}
					/>

					<div
						className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]"
						data-reveal
					>
						<div className="max-w-[800px]">
							<span className="font-[family-name:var(--font-cutive)] block text-[11px] tracking-[0.2em] uppercase text-lp-gold opacity-80 mb-[clamp(16px,2vw,32px)]">
								Ready to optimize your time?
							</span>

							<h2 className="lp-cta-title font-[family-name:var(--font-bebas)] text-[clamp(5rem,14vw,16rem)] leading-[0.9] tracking-[-0.01em] text-lp-parchment mb-[clamp(24px,4vw,48px)]">
								Begin<span className="text-lp-gold">.</span>
							</h2>

							<p className="text-[clamp(1rem,1.5vw,1.15rem)] leading-[1.7] text-lp-parchment opacity-50 max-w-[480px] mb-[clamp(32px,4vw,56px)]">
								Start with the free tier. No credit card required. Your calendar deserves better
								than guesswork.
							</p>

							<div className="flex gap-5 items-center flex-wrap">
								<a href="/sign-in" className="lp-btn-gold !text-sm !py-[18px] !px-14">
									Start Free
								</a>
								<a href="/sign-in" className="lp-btn-outline !text-sm !py-[18px] !px-10">
									Log in
								</a>
							</div>
						</div>
					</div>
				</section>

				{/* ═══ FOOTER ═══ */}
				<footer className="bg-lp-navy border-t border-lp-parchment/[0.06]">
					<div className="max-w-[1280px] mx-auto px-[clamp(24px,5vw,80px)] relative z-[1]">
						<div className="py-[clamp(40px,5vw,64px)] grid grid-cols-[2fr_1fr_1fr] gap-[clamp(24px,4vw,64px)] items-start">
							{/* Brand */}
							<div>
								<div className="font-[family-name:var(--font-outfit)] font-extrabold text-base tracking-[0.08em] uppercase text-lp-parchment flex items-center gap-2.5 mb-4">
									<span
										aria-hidden="true"
										className="w-1.5 h-1.5 bg-lp-gold rounded-full inline-block"
									/>
									Auto Cron
								</div>
								<p className="text-[13px] leading-[1.6] text-lp-parchment opacity-35 max-w-[280px]">
									Intelligent auto-scheduling that puts your priorities first.
								</p>
							</div>

							{/* Links */}
							<div>
								<h4 className="font-[family-name:var(--font-cutive)] text-[10px] tracking-[0.2em] uppercase text-lp-gold opacity-60 mb-5">
									Product
								</h4>
								{[
									{ label: "Features", href: "#features" },
									{ label: "Process", href: "#process" },
									{ label: "Pricing", href: "#pricing" },
									{ label: "Dashboard", href: "/app/calendar" },
								].map((link) => (
									<a key={link.label} href={link.href} className="lp-footer-link">
										{link.label}
									</a>
								))}
							</div>

							{/* Meta */}
							<div>
								<h4 className="font-[family-name:var(--font-cutive)] text-[10px] tracking-[0.2em] uppercase text-lp-gold opacity-60 mb-5">
									Company
								</h4>
								{["Privacy", "Terms", "Contact"].map((link) => (
									<a key={link} href={`#${link.toLowerCase()}`} className="lp-footer-link">
										{link}
									</a>
								))}
							</div>
						</div>

						{/* Bottom bar */}
						<div className="border-t border-lp-parchment/[0.06] py-6 pb-[clamp(32px,4vw,48px)] flex justify-between items-center flex-wrap gap-3">
							<p className="font-[family-name:var(--font-cutive)] text-[10px] tracking-[0.06em] text-lp-parchment opacity-25">
								{new Date().getFullYear()} Auto Cron. All rights reserved.
							</p>
							<p className="font-[family-name:var(--font-cutive)] text-[10px] tracking-[0.12em] uppercase text-lp-parchment opacity-15">
								Swiss Typographic Style
							</p>
						</div>
					</div>
				</footer>
			</div>
		</div>
	);
}
