import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware();

const PROTECTED_ROUTES = ["calendar", "tasks", "habits", "settings"] as const;
const protectedRouteMatcher = `/(${PROTECTED_ROUTES.join("|")})/:path*`;
const autumnApiMatcher = "/api/autumn/:path*";
const homeMatcher = "/";
const signInMatcher = "/sign-in";

export const config = {
	matcher: [protectedRouteMatcher, autumnApiMatcher, homeMatcher, signInMatcher],
};
