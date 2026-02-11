import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware();

export const config = {
	matcher: [
		"/calendar/:path*",
		"/tasks/:path*",
		"/habits/:path*",
		"/pricing/:path*",
		"/settings/:path*",
	],
};
