import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware();

const appMatcher = "/app/:path*";
const autumnApiMatcher = "/api/autumn/:path*";
const homeMatcher = "/";
const signInMatcher = "/sign-in";

export const config = {
	matcher: [appMatcher, autumnApiMatcher, homeMatcher, signInMatcher],
};
