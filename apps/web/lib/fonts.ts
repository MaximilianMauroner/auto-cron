import { Bebas_Neue, Cutive_Mono, Outfit } from "next/font/google";

export const bebasNeue = Bebas_Neue({
	subsets: ["latin"],
	weight: ["400"],
	variable: "--font-bebas",
	display: "swap",
});

export const outfit = Outfit({
	subsets: ["latin"],
	variable: "--font-outfit",
	weight: ["300", "400", "500", "600", "700", "800"],
	display: "swap",
});

export const cutiveMono = Cutive_Mono({
	subsets: ["latin"],
	weight: ["400"],
	variable: "--font-cutive",
	display: "swap",
});
