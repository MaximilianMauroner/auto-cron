import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@auto-cron/types"],
};

export default nextConfig;
