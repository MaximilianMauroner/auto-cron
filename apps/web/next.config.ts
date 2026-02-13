import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@auto-cron/types"],
	experimental: {
		reactCompiler: true,
	},
};

export default nextConfig;
