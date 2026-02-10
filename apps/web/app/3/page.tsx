"use client";

import { Fraunces, Lora } from "next/font/google";
import { type ReactNode, useEffect, useRef, useState } from "react";

const fraunces = Fraunces({
	subsets: ["latin"],
	weight: ["300", "400", "500", "700"],
	style: ["normal", "italic"],
	variable: "--font-fraunces",
});

const lora = Lora({
	subsets: ["latin"],
	weight: ["400", "500"],
	variable: "--font-lora",
});

/* ──────────── Intersection Observer Hook ──────────── */
function useInView(threshold = 0.15) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const obs = new IntersectionObserver(
			(entries) => {
				const e = entries[0];
				if (e?.isIntersecting) {
					setVisible(true);
					obs.unobserve(el);
				}
			},
			{ threshold },
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [threshold]);
	return { ref, visible };
}

function FadeInUp({
	children,
	delay = 0,
	className = "",
}: {
	children: ReactNode;
	delay?: number;
	className?: string;
}) {
	const { ref, visible } = useInView();
	return (
		<div
			ref={ref}
			className={className}
			style={{
				opacity: visible ? 1 : 0,
				transform: visible ? "translateY(0)" : "translateY(32px)",
				transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
			}}
		>
			{children}
		</div>
	);
}

/* ──────────── Inline SVG Icons ──────────── */
function SeedlingIcon({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
			<path d="M32 56V32" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
			<path
				d="M32 40C32 40 20 38 18 26C18 26 30 24 32 36"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="currentColor"
				fillOpacity="0.2"
			/>
			<path
				d="M32 32C32 32 44 30 46 18C46 18 34 16 32 28"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="currentColor"
				fillOpacity="0.2"
			/>
		</svg>
	);
}

function LeafIcon({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
			<path
				d="M16 48C16 48 14 20 44 12C44 12 46 40 16 48Z"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinejoin="round"
				fill="currentColor"
				fillOpacity="0.2"
			/>
			<path
				d="M16 48C24 36 36 24 44 12"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			<path
				d="M28 30C24 36 20 40 16 44"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				opacity="0.5"
			/>
		</svg>
	);
}

function SunIcon({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 64 64" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
			<circle
				cx="32"
				cy="32"
				r="10"
				stroke="currentColor"
				strokeWidth="3"
				fill="currentColor"
				fillOpacity="0.2"
			/>
			{[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
				const rad = (angle * Math.PI) / 180;
				const x1 = 32 + Math.cos(rad) * 16;
				const y1 = 32 + Math.sin(rad) * 16;
				const x2 = 32 + Math.cos(rad) * 22;
				const y2 = 32 + Math.sin(rad) * 22;
				return (
					<line
						key={angle}
						x1={x1}
						y1={y1}
						x2={x2}
						y2={y2}
						stroke="currentColor"
						strokeWidth="3"
						strokeLinecap="round"
					/>
				);
			})}
		</svg>
	);
}

function LeafDivider() {
	return (
		<div className="flex items-center justify-center gap-3 py-4">
			<div className="h-px w-16" style={{ backgroundColor: "#E5DED3" }} />
			<svg viewBox="0 0 32 32" fill="none" className="h-6 w-6" style={{ color: "#4A8C5C" }}>
				<path
					d="M8 24C8 24 7 10 22 6C22 6 23 20 8 24Z"
					fill="currentColor"
					fillOpacity="0.3"
					stroke="currentColor"
					strokeWidth="1.5"
				/>
				<path d="M8 24C12 18 18 12 22 6" stroke="currentColor" strokeWidth="1" />
			</svg>
			<div className="h-px w-16" style={{ backgroundColor: "#E5DED3" }} />
		</div>
	);
}

function CheckIcon() {
	return (
		<svg
			viewBox="0 0 20 20"
			fill="none"
			className="mt-0.5 h-5 w-5 shrink-0"
			style={{ color: "#4A8C5C" }}
		>
			<path
				d="M5 10.5L8.5 14L15 7"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/* ──────────── Wavy Divider ──────────── */
function WaveDivider({
	fill = "#F0F5F1",
	flip = false,
}: {
	fill?: string;
	flip?: boolean;
}) {
	return (
		<div className="w-full leading-[0]" style={{ transform: flip ? "scaleY(-1)" : undefined }}>
			<svg
				viewBox="0 0 1440 120"
				preserveAspectRatio="none"
				className="block h-[60px] w-full md:h-[80px]"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M0,40 C240,100 480,0 720,50 C960,100 1200,10 1440,60 L1440,120 L0,120 Z"
					fill={fill}
				/>
			</svg>
		</div>
	);
}

/* ──────────── Main Page ──────────── */
export default function BloomLandingPage() {
	const [mobileMenu, setMobileMenu] = useState(false);

	return (
		<div
			className={`${fraunces.variable} ${lora.variable} min-h-screen`}
			style={{
				backgroundColor: "#FBF7F0",
				color: "#2A2A28",
				fontFamily: "var(--font-lora), Georgia, serif",
			}}
		>
			{/* ──── Global Keyframes ──── */}
			<style>{`
        @keyframes blobFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-18px) rotate(1deg); }
          66% { transform: translateY(10px) rotate(-1deg); }
        }
        @keyframes blobFloat2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-25px) rotate(2deg); }
        }
        .blob-animate {
          animation: blobFloat 10s ease-in-out infinite;
        }
        .blob-animate-2 {
          animation: blobFloat2 8s ease-in-out infinite;
        }
        .card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(45,90,61,0.1);
        }
        .btn-hover {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .btn-hover:hover {
          transform: scale(1.03);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
      `}</style>

			{/* ════════════════════════════════════════════════════
           SECTION 1 — NAVIGATION
           ════════════════════════════════════════════════════ */}
			<nav
				className="sticky top-0 z-50 border-b backdrop-blur-md"
				style={{
					backgroundColor: "rgba(251,247,240,0.9)",
					borderColor: "#E5DED3",
				}}
			>
				<div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
					{/* Logo */}
					<a
						href="#"
						className="text-2xl"
						style={{
							fontFamily: "var(--font-fraunces), Georgia, serif",
							fontStyle: "italic",
							color: "#2D5A3D",
							fontWeight: 500,
						}}
					>
						auto cron
					</a>

					{/* Center nav — desktop */}
					<div
						className="hidden items-center gap-8 md:flex"
						style={{
							fontFamily: "var(--font-lora), Georgia, serif",
							color: "#7A7A72",
						}}
					>
						<a
							href="#features"
							className="transition-colors hover:opacity-80"
							style={{ color: "#2A2A28" }}
						>
							Features
						</a>
						<a
							href="#approach"
							className="transition-colors hover:opacity-80"
							style={{ color: "#2A2A28" }}
						>
							Approach
						</a>
						<a
							href="#pricing"
							className="transition-colors hover:opacity-80"
							style={{ color: "#2A2A28" }}
						>
							Pricing
						</a>
					</div>

					{/* Right */}
					<div className="hidden items-center gap-4 md:flex">
						<a
							href="#"
							className="transition-opacity hover:opacity-70"
							style={{
								fontFamily: "var(--font-lora), Georgia, serif",
								color: "#2D5A3D",
							}}
						>
							Sign in
						</a>
						<a
							href="#"
							className="btn-hover rounded-full px-6 py-2.5 text-sm font-medium text-white"
							style={{
								backgroundColor: "#E8785C",
								fontFamily: "var(--font-lora), Georgia, serif",
							}}
						>
							Get Started
						</a>
					</div>

					{/* Mobile hamburger */}
					<button
						className="md:hidden"
						onClick={() => setMobileMenu(!mobileMenu)}
						aria-label="Toggle menu"
					>
						<svg
							viewBox="0 0 24 24"
							className="h-6 w-6"
							stroke="#2D5A3D"
							strokeWidth="2"
							strokeLinecap="round"
						>
							{mobileMenu ? (
								<>
									<line x1="6" y1="6" x2="18" y2="18" />
									<line x1="6" y1="18" x2="18" y2="6" />
								</>
							) : (
								<>
									<line x1="4" y1="7" x2="20" y2="7" />
									<line x1="4" y1="12" x2="20" y2="12" />
									<line x1="4" y1="17" x2="20" y2="17" />
								</>
							)}
						</svg>
					</button>
				</div>

				{/* Mobile menu */}
				{mobileMenu && (
					<div className="border-t px-6 pb-6 pt-4 md:hidden" style={{ borderColor: "#E5DED3" }}>
						<div className="flex flex-col gap-4">
							<a href="#features" style={{ color: "#2A2A28" }}>
								Features
							</a>
							<a href="#approach" style={{ color: "#2A2A28" }}>
								Approach
							</a>
							<a href="#pricing" style={{ color: "#2A2A28" }}>
								Pricing
							</a>
							<div className="mt-2 flex items-center gap-4">
								<a href="#" style={{ color: "#2D5A3D" }}>
									Sign in
								</a>
								<a
									href="#"
									className="rounded-full px-6 py-2.5 text-sm text-white"
									style={{ backgroundColor: "#E8785C" }}
								>
									Get Started
								</a>
							</div>
						</div>
					</div>
				)}
			</nav>

			{/* ════════════════════════════════════════════════════
           SECTION 2 — HERO
           ════════════════════════════════════════════════════ */}
			<section className="relative overflow-hidden px-6 pb-20 pt-20 md:pb-32 md:pt-28">
				{/* Decorative blobs */}
				<div
					className="blob-animate pointer-events-none absolute -left-32 -top-20 h-[500px] w-[500px] opacity-[0.12]"
					style={{
						background: "radial-gradient(circle, #2D5A3D 0%, transparent 70%)",
						borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
					}}
				/>
				<div
					className="blob-animate-2 pointer-events-none absolute -right-40 top-20 h-[450px] w-[450px] opacity-[0.10]"
					style={{
						background: "radial-gradient(circle, #D4A853 0%, transparent 70%)",
						borderRadius: "60% 40% 30% 70% / 50% 60% 40% 50%",
					}}
				/>
				<div
					className="blob-animate pointer-events-none absolute bottom-0 left-1/3 h-[350px] w-[350px] opacity-[0.08]"
					style={{
						background: "radial-gradient(circle, #E8785C 0%, transparent 70%)",
						borderRadius: "40% 60% 55% 45% / 55% 40% 60% 45%",
					}}
				/>

				<div className="relative mx-auto max-w-4xl text-center">
					<FadeInUp>
						{/* Badge */}
						<div
							className="mb-8 inline-flex items-center gap-2 rounded-full px-5 py-2"
							style={{ backgroundColor: "rgba(74,140,92,0.12)" }}
						>
							<span className="text-sm" style={{ fontSize: "14px" }}>
								&#10024;
							</span>
							<span
								className="text-sm font-medium"
								style={{
									color: "#2D5A3D",
									fontFamily: "var(--font-lora), Georgia, serif",
								}}
							>
								Intelligent Scheduling
							</span>
						</div>
					</FadeInUp>

					<FadeInUp delay={0.1}>
						<h1
							className="mb-6 text-5xl leading-[1.1] md:text-7xl"
							style={{
								fontFamily: "var(--font-fraunces), Georgia, serif",
								color: "#2D5A3D",
								fontWeight: 700,
								letterSpacing: "-0.02em",
							}}
						>
							Let your schedule
							<br />
							bloom.
						</h1>
					</FadeInUp>

					<FadeInUp delay={0.2}>
						<p
							className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed md:text-xl"
							style={{
								color: "#7A7A72",
								fontFamily: "var(--font-lora), Georgia, serif",
							}}
						>
							Auto Cron nurtures your tasks, habits, and calendar events &mdash; growing them into a
							schedule that respects your rhythms and priorities.
						</p>
					</FadeInUp>

					<FadeInUp delay={0.3}>
						<div className="mb-12 flex flex-wrap items-center justify-center gap-4">
							<a
								href="#"
								className="btn-hover rounded-xl px-8 py-3.5 text-base font-medium text-white shadow-lg"
								style={{
									backgroundColor: "#2D5A3D",
									fontFamily: "var(--font-lora), Georgia, serif",
									boxShadow: "0 4px 20px rgba(45,90,61,0.3)",
								}}
							>
								Start Growing
							</a>
							<a
								href="#"
								className="btn-hover rounded-xl border-2 px-8 py-3.5 text-base font-medium"
								style={{
									borderColor: "#2D5A3D",
									color: "#2D5A3D",
									fontFamily: "var(--font-lora), Georgia, serif",
								}}
							>
								Watch it Bloom
							</a>
						</div>
					</FadeInUp>

					<FadeInUp delay={0.4}>
						<div
							className="mx-auto inline-flex flex-wrap items-center justify-center gap-0 rounded-2xl border px-2 py-2 md:gap-0 md:px-0"
							style={{
								backgroundColor: "#FFFFFF",
								borderColor: "#E5DED3",
							}}
						>
							{[
								{ label: "5 Priority Levels", icon: "layers" },
								{ label: "75-Day Horizon", icon: "calendar" },
								{ label: "Bidirectional Sync", icon: "sync" },
							].map((stat, i) => (
								<div key={i} className="flex items-center">
									<div className="flex items-center gap-2 px-5 py-3 md:px-6">
										<div
											className="flex h-7 w-7 items-center justify-center rounded-full"
											style={{ backgroundColor: "rgba(74,140,92,0.12)" }}
										>
											<svg viewBox="0 0 16 16" className="h-3.5 w-3.5" style={{ color: "#2D5A3D" }}>
												{stat.icon === "layers" && (
													<path
														d="M8 1L1 5L8 9L15 5L8 1Z M1 8L8 12L15 8 M1 11L8 15L15 11"
														stroke="currentColor"
														strokeWidth="1.5"
														fill="none"
														strokeLinejoin="round"
													/>
												)}
												{stat.icon === "calendar" && (
													<>
														<rect
															x="2"
															y="3"
															width="12"
															height="11"
															rx="2"
															stroke="currentColor"
															strokeWidth="1.5"
															fill="none"
														/>
														<line
															x1="2"
															y1="7"
															x2="14"
															y2="7"
															stroke="currentColor"
															strokeWidth="1.5"
														/>
														<line
															x1="5"
															y1="1"
															x2="5"
															y2="4"
															stroke="currentColor"
															strokeWidth="1.5"
															strokeLinecap="round"
														/>
														<line
															x1="11"
															y1="1"
															x2="11"
															y2="4"
															stroke="currentColor"
															strokeWidth="1.5"
															strokeLinecap="round"
														/>
													</>
												)}
												{stat.icon === "sync" && (
													<>
														<path
															d="M2 8A6 6 0 0 1 12 4"
															stroke="currentColor"
															strokeWidth="1.5"
															fill="none"
															strokeLinecap="round"
														/>
														<path
															d="M14 8A6 6 0 0 1 4 12"
															stroke="currentColor"
															strokeWidth="1.5"
															fill="none"
															strokeLinecap="round"
														/>
														<path
															d="M10 2L12 4L10 6"
															stroke="currentColor"
															strokeWidth="1.5"
															fill="none"
															strokeLinecap="round"
															strokeLinejoin="round"
														/>
														<path
															d="M6 10L4 12L6 14"
															stroke="currentColor"
															strokeWidth="1.5"
															fill="none"
															strokeLinecap="round"
															strokeLinejoin="round"
														/>
													</>
												)}
											</svg>
										</div>
										<span
											className="whitespace-nowrap text-sm font-medium"
											style={{
												color: "#2A2A28",
												fontFamily: "var(--font-lora), Georgia, serif",
											}}
										>
											{stat.label}
										</span>
									</div>
									{i < 2 && (
										<div
											className="hidden h-8 w-px md:block"
											style={{ backgroundColor: "#E5DED3" }}
										/>
									)}
								</div>
							))}
						</div>
					</FadeInUp>
				</div>
			</section>

			{/* ════════════════════════════════════════════════════
           SECTION 3 — FEATURE CARDS
           ════════════════════════════════════════════════════ */}
			<section id="features" className="px-6 pb-20 pt-10 md:pb-28">
				<div className="mx-auto max-w-6xl">
					<FadeInUp>
						<div className="mb-16 text-center">
							<LeafDivider />
							<h2
								className="mb-4 mt-6 text-3xl md:text-5xl"
								style={{
									fontFamily: "var(--font-fraunces), Georgia, serif",
									color: "#2D5A3D",
									fontWeight: 500,
								}}
							>
								Cultivate your perfect day
							</h2>
							<p
								className="mx-auto max-w-xl text-lg"
								style={{
									color: "#7A7A72",
									fontFamily: "var(--font-lora), Georgia, serif",
								}}
							>
								Every tool you need to grow a schedule that works for you.
							</p>
						</div>
					</FadeInUp>

					<div className="grid gap-8 md:grid-cols-3">
						{[
							{
								icon: <SeedlingIcon className="h-8 w-8" />,
								iconBg: "#2D5A3D",
								title: "Task Garden",
								desc: "Plant your tasks with priorities from gentle to urgent. Watch them find their perfect time slot, growing into a productive schedule.",
							},
							{
								icon: <LeafIcon className="h-8 w-8" />,
								iconBg: "#D4A853",
								title: "Habit Rhythms",
								desc: "Establish daily, weekly, and monthly rhythms. Auto Cron places them in your preferred windows, letting habits take root.",
							},
							{
								icon: <SunIcon className="h-8 w-8" />,
								iconBg: "#E8785C",
								title: "Calendar Harmony",
								desc: "Bidirectional Google Calendar sync keeps everything in bloom. Your events, tasks, and habits \u2014 one unified garden.",
							},
						].map((card, i) => (
							<FadeInUp key={i} delay={i * 0.15}>
								<div
									className="card-hover h-full rounded-2xl border p-8 md:p-10"
									style={{
										backgroundColor: "#F5EFE6",
										borderColor: "#E5DED3",
									}}
								>
									<div
										className="mb-6 flex h-16 w-16 items-center justify-center rounded-full text-white"
										style={{ backgroundColor: card.iconBg }}
									>
										{card.icon}
									</div>
									<h3
										className="mb-3 text-xl md:text-2xl"
										style={{
											fontFamily: "var(--font-fraunces), Georgia, serif",
											color: "#2D5A3D",
											fontWeight: 500,
										}}
									>
										{card.title}
									</h3>
									<p
										className="leading-relaxed"
										style={{
											color: "#7A7A72",
											fontFamily: "var(--font-lora), Georgia, serif",
										}}
									>
										{card.desc}
									</p>
								</div>
							</FadeInUp>
						))}
					</div>
				</div>
			</section>

			{/* ════════════════════════════════════════════════════
           SECTION 4 — HOW IT GROWS (Process)
           ════════════════════════════════════════════════════ */}
			<WaveDivider fill="#F0F5F1" />
			<section
				id="approach"
				className="px-6 pb-20 pt-16 md:pb-28"
				style={{ backgroundColor: "#F0F5F1" }}
			>
				<div className="mx-auto max-w-6xl">
					<FadeInUp>
						<div className="mb-16 text-center">
							<h2
								className="mb-4 text-3xl md:text-5xl"
								style={{
									fontFamily: "var(--font-fraunces), Georgia, serif",
									color: "#2D5A3D",
									fontWeight: 500,
								}}
							>
								How it grows
							</h2>
							<p
								className="mx-auto max-w-xl text-lg"
								style={{
									color: "#7A7A72",
									fontFamily: "var(--font-lora), Georgia, serif",
								}}
							>
								From seed to harvest in four simple steps.
							</p>
						</div>
					</FadeInUp>

					<div className="space-y-16 md:space-y-24">
						{[
							{
								num: "01",
								title: "Plant Your Seeds",
								desc: "Define tasks with 5 priority levels, set habits with your preferred rhythms, and connect your Google Calendar. Everything starts with intention.",
								color: "#2D5A3D",
								accentBg: "rgba(45,90,61,0.08)",
							},
							{
								num: "02",
								title: "Set the Conditions",
								desc: "Configure your working hours, preferred habit windows, and scheduling horizon. Tell Auto Cron when you're at your best — it listens.",
								color: "#D4A853",
								accentBg: "rgba(212,168,83,0.1)",
							},
							{
								num: "03",
								title: "Watch It Grow",
								desc: "The algorithm finds optimal time slots, respects your boundaries, and resolves conflicts intelligently. Your schedule takes shape organically.",
								color: "#4A8C5C",
								accentBg: "rgba(74,140,92,0.08)",
							},
							{
								num: "04",
								title: "Harvest Your Day",
								desc: "Your optimized schedule appears directly in your Google Calendar, beautifully organized and ready to follow. Just show up and thrive.",
								color: "#E8785C",
								accentBg: "rgba(232,120,92,0.1)",
							},
						].map((step, i) => {
							const isReversed = i % 2 !== 0;
							return (
								<FadeInUp key={i} delay={0.1}>
									<div
										className={`flex flex-col items-center gap-8 md:gap-16 ${
											isReversed ? "md:flex-row-reverse" : "md:flex-row"
										}`}
									>
										{/* Text side */}
										<div className="flex-1">
											<span
												className="mb-3 block text-6xl font-light md:text-7xl"
												style={{
													fontFamily: "var(--font-fraunces), Georgia, serif",
													color: step.color,
													opacity: 0.2,
													fontWeight: 300,
												}}
											>
												{step.num}
											</span>
											<h3
												className="mb-4 text-2xl md:text-3xl"
												style={{
													fontFamily: "var(--font-fraunces), Georgia, serif",
													color: "#2D5A3D",
													fontWeight: 500,
												}}
											>
												{step.title}
											</h3>
											<p
												className="max-w-md text-base leading-relaxed md:text-lg"
												style={{
													color: "#7A7A72",
													fontFamily: "var(--font-lora), Georgia, serif",
												}}
											>
												{step.desc}
											</p>
										</div>

										{/* Visual side — abstract decorative shape */}
										<div className="flex flex-1 items-center justify-center">
											<div
												className="relative flex h-48 w-full max-w-sm items-center justify-center rounded-3xl md:h-56"
												style={{ backgroundColor: step.accentBg }}
											>
												{/* Inner decorative elements */}
												<div
													className="absolute left-6 top-6 h-12 w-12 rounded-full opacity-20"
													style={{ backgroundColor: step.color }}
												/>
												<div
													className="absolute bottom-8 right-8 h-8 w-8 opacity-15"
													style={{
														backgroundColor: step.color,
														borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
													}}
												/>
												<div
													className="absolute right-12 top-10 h-6 w-6 rounded-full opacity-10"
													style={{ backgroundColor: step.color }}
												/>
												{/* Central visual */}
												<div
													className="flex h-20 w-20 items-center justify-center rounded-2xl text-white"
													style={{ backgroundColor: step.color, opacity: 0.9 }}
												>
													<span
														className="text-2xl font-light"
														style={{
															fontFamily: "var(--font-fraunces), Georgia, serif",
														}}
													>
														{step.num}
													</span>
												</div>
												{/* Decorative lines */}
												<div
													className="absolute bottom-6 left-12 h-px w-16 opacity-15"
													style={{ backgroundColor: step.color }}
												/>
												<div
													className="absolute right-6 top-1/2 h-px w-12 opacity-10"
													style={{ backgroundColor: step.color }}
												/>
											</div>
										</div>
									</div>
								</FadeInUp>
							);
						})}
					</div>
				</div>
			</section>
			<WaveDivider fill="#FBF7F0" flip />

			{/* ════════════════════════════════════════════════════
           SECTION 5 — QUOTE / TESTIMONIAL
           ════════════════════════════════════════════════════ */}
			<section className="px-6 py-20 md:py-32">
				<FadeInUp>
					<div className="mx-auto max-w-3xl text-center">
						<div className="relative">
							{/* Decorative quotation marks */}
							<span
								className="pointer-events-none absolute -left-4 -top-8 select-none text-7xl leading-none md:-left-10 md:-top-10 md:text-9xl"
								style={{
									fontFamily: "var(--font-fraunces), Georgia, serif",
									color: "#E8785C",
									opacity: 0.2,
								}}
							>
								&ldquo;
							</span>
							<span
								className="pointer-events-none absolute -bottom-14 -right-4 select-none text-7xl leading-none md:-bottom-16 md:-right-10 md:text-9xl"
								style={{
									fontFamily: "var(--font-fraunces), Georgia, serif",
									color: "#E8785C",
									opacity: 0.2,
								}}
							>
								&rdquo;
							</span>

							<blockquote
								className="relative text-2xl leading-relaxed md:text-4xl md:leading-snug"
								style={{
									fontFamily: "var(--font-fraunces), Georgia, serif",
									fontStyle: "italic",
									color: "#2D5A3D",
									fontWeight: 300,
								}}
							>
								The best schedule is one that feels natural &mdash; like it grew there on its own.
							</blockquote>
						</div>
						<p
							className="mt-8 text-base"
							style={{
								color: "#7A7A72",
								fontFamily: "var(--font-lora), Georgia, serif",
							}}
						>
							&mdash; The Auto Cron Philosophy
						</p>
					</div>
				</FadeInUp>
			</section>

			{/* ════════════════════════════════════════════════════
           SECTION 6 — PRICING
           ════════════════════════════════════════════════════ */}
			<section id="pricing" className="px-6 pb-20 pt-10 md:pb-28">
				<div className="mx-auto max-w-6xl">
					<FadeInUp>
						<div className="mb-16 text-center">
							<LeafDivider />
							<h2
								className="mb-4 mt-6 text-3xl md:text-5xl"
								style={{
									fontFamily: "var(--font-fraunces), Georgia, serif",
									color: "#2D5A3D",
									fontWeight: 500,
								}}
							>
								Choose your garden
							</h2>
							<p
								className="mx-auto max-w-xl text-lg"
								style={{
									color: "#7A7A72",
									fontFamily: "var(--font-lora), Georgia, serif",
								}}
							>
								Plans that grow with you. Start small, flourish over time.
							</p>
						</div>
					</FadeInUp>

					<div className="grid gap-8 md:grid-cols-3">
						{[
							{
								name: "Seedling",
								tier: "Basic",
								price: "5",
								accent: "#2D5A3D",
								accentBg: "rgba(45,90,61,0.06)",
								features: [
									"50 scheduled tasks",
									"5 habits",
									"100 scheduling runs",
									"Google Calendar sync",
									"5 priority levels",
								],
								popular: false,
							},
							{
								name: "Flourishing",
								tier: "Pro",
								price: "8",
								accent: "#E8785C",
								accentBg: "rgba(232,120,92,0.06)",
								features: [
									"200 scheduled tasks",
									"20 habits",
									"500 scheduling runs",
									"Google Calendar sync",
									"Priority support",
									"Custom scheduling rules",
								],
								popular: true,
							},
							{
								name: "Evergreen",
								tier: "Premium",
								price: "16",
								accent: "#D4A853",
								accentBg: "rgba(212,168,83,0.06)",
								features: [
									"Unlimited tasks",
									"Unlimited habits",
									"Unlimited runs",
									"Google Calendar sync",
									"Advanced analytics",
									"API access",
									"Priority support",
								],
								popular: false,
							},
						].map((plan, i) => (
							<FadeInUp key={i} delay={i * 0.12}>
								<div
									className={`card-hover relative flex h-full flex-col rounded-2xl border p-8 md:p-10 ${
										plan.popular ? "shadow-lg" : ""
									}`}
									style={{
										backgroundColor: "#FFFFFF",
										borderColor: plan.popular ? plan.accent : "#E5DED3",
										borderWidth: plan.popular ? "2px" : "1px",
									}}
								>
									{/* Top accent bar */}
									<div
										className="absolute left-0 right-0 top-0 h-1.5 rounded-t-2xl"
										style={{ backgroundColor: plan.accent }}
									/>

									{/* Popular badge */}
									{plan.popular && (
										<div
											className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-4 py-1 text-xs font-medium text-white"
											style={{
												backgroundColor: plan.accent,
												fontFamily: "var(--font-lora), Georgia, serif",
											}}
										>
											Most Popular
										</div>
									)}

									<div className="mb-1 mt-2">
										<span
											className="text-sm font-medium uppercase tracking-wider"
											style={{
												color: plan.accent,
												fontFamily: "var(--font-lora), Georgia, serif",
											}}
										>
											{plan.tier}
										</span>
									</div>
									<h3
										className="mb-4 text-2xl"
										style={{
											fontFamily: "var(--font-fraunces), Georgia, serif",
											color: "#2D5A3D",
											fontWeight: 500,
										}}
									>
										{plan.name}
									</h3>
									<div className="mb-6 flex items-baseline gap-1">
										<span
											className="text-4xl md:text-5xl"
											style={{
												fontFamily: "var(--font-fraunces), Georgia, serif",
												color: "#2A2A28",
												fontWeight: 700,
											}}
										>
											&euro;{plan.price}
										</span>
										<span
											className="text-base"
											style={{
												color: "#7A7A72",
												fontFamily: "var(--font-lora), Georgia, serif",
											}}
										>
											/month
										</span>
									</div>

									<ul className="mb-8 flex-1 space-y-3">
										{plan.features.map((feat, j) => (
											<li
												key={j}
												className="flex items-start gap-2.5"
												style={{
													fontFamily: "var(--font-lora), Georgia, serif",
													color: "#2A2A28",
												}}
											>
												<CheckIcon />
												<span className="text-sm">{feat}</span>
											</li>
										))}
									</ul>

									<a
										href="#"
										className="btn-hover block rounded-full py-3 text-center text-sm font-medium text-white"
										style={{
											backgroundColor: plan.accent,
											fontFamily: "var(--font-lora), Georgia, serif",
										}}
									>
										Get Started
									</a>
								</div>
							</FadeInUp>
						))}
					</div>
				</div>
			</section>

			{/* ════════════════════════════════════════════════════
           SECTION 7 — FINAL CTA
           ════════════════════════════════════════════════════ */}
			<section
				className="px-6 py-20 md:py-32"
				style={{
					background: "linear-gradient(180deg, #FBF7F0 0%, #F0F5F1 50%, #FBF7F0 100%)",
				}}
			>
				<FadeInUp>
					<div className="mx-auto max-w-3xl text-center">
						<h2
							className="mb-6 text-3xl md:text-5xl"
							style={{
								fontFamily: "var(--font-fraunces), Georgia, serif",
								color: "#2D5A3D",
								fontWeight: 700,
							}}
						>
							Ready to let your
							<br />
							schedule bloom?
						</h2>
						<p
							className="mx-auto mb-10 max-w-lg text-lg leading-relaxed"
							style={{
								color: "#7A7A72",
								fontFamily: "var(--font-lora), Georgia, serif",
							}}
						>
							Join thousands who&apos;ve found their rhythm with Auto Cron.
						</p>
						<a
							href="#"
							className="btn-hover inline-block rounded-full px-10 py-4 text-lg font-medium text-white"
							style={{
								backgroundColor: "#E8785C",
								fontFamily: "var(--font-lora), Georgia, serif",
								boxShadow: "0 6px 24px rgba(232,120,92,0.35)",
							}}
						>
							Start Growing &mdash; Free
						</a>
						<p
							className="mt-4 text-sm"
							style={{
								color: "#7A7A72",
								fontFamily: "var(--font-lora), Georgia, serif",
							}}
						>
							No credit card required
						</p>
					</div>
				</FadeInUp>
			</section>

			{/* ════════════════════════════════════════════════════
           SECTION 8 — FOOTER
           ════════════════════════════════════════════════════ */}
			<footer
				className="border-t px-6 pb-8 pt-16"
				style={{
					backgroundColor: "#FBF7F0",
					borderColor: "#E5DED3",
				}}
			>
				<div className="mx-auto max-w-6xl">
					<div className="mb-12 grid gap-10 md:grid-cols-4">
						{/* Logo col */}
						<div className="md:col-span-1">
							<a
								href="#"
								className="mb-3 block text-xl"
								style={{
									fontFamily: "var(--font-fraunces), Georgia, serif",
									fontStyle: "italic",
									color: "#2D5A3D",
									fontWeight: 500,
								}}
							>
								auto cron
							</a>
							<p
								className="text-sm leading-relaxed"
								style={{
									color: "#7A7A72",
									fontFamily: "var(--font-lora), Georgia, serif",
								}}
							>
								Scheduling, naturally.
							</p>
						</div>

						{/* Link columns */}
						{[
							{
								heading: "Product",
								links: ["Features", "Pricing", "Changelog", "Integrations"],
							},
							{
								heading: "Company",
								links: ["About", "Blog", "Careers", "Contact"],
							},
							{
								heading: "Legal",
								links: ["Privacy", "Terms", "Cookie Policy"],
							},
						].map((col, i) => (
							<div key={i}>
								<h4
									className="mb-4 text-sm font-medium uppercase tracking-wider"
									style={{
										color: "#2A2A28",
										fontFamily: "var(--font-lora), Georgia, serif",
									}}
								>
									{col.heading}
								</h4>
								<ul className="space-y-2.5">
									{col.links.map((link, j) => (
										<li key={j}>
											<a
												href="#"
												className="text-sm transition-opacity hover:opacity-70"
												style={{
													color: "#7A7A72",
													fontFamily: "var(--font-lora), Georgia, serif",
												}}
											>
												{link}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>

					{/* Bottom bar */}
					<div
						className="flex flex-col items-center justify-between gap-3 border-t pt-8 md:flex-row"
						style={{ borderColor: "#E5DED3" }}
					>
						<p
							className="text-sm"
							style={{
								color: "#7A7A72",
								fontFamily: "var(--font-lora), Georgia, serif",
							}}
						>
							&copy; {new Date().getFullYear()} Auto Cron. All rights reserved.
						</p>
						<p
							className="text-sm"
							style={{
								color: "#7A7A72",
								fontFamily: "var(--font-lora), Georgia, serif",
							}}
						>
							Made with{" "}
							<span role="img" aria-label="seedling">
								&#127793;
							</span>{" "}
						</p>
					</div>
				</div>
			</footer>
		</div>
	);
}
