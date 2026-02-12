import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware();

const PROTECTED_ROUTES = ["calendar", "tasks", "habits", "pricing", "settings"] as const;
const protectedRouteMatcher = `/(${PROTECTED_ROUTES.join("|")})/:path*`;

export const config = {
	matcher: [protectedRouteMatcher],
};
