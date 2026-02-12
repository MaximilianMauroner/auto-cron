import { serverEnv } from "@/env/server";
import { getWorkOS } from "@workos-inc/authkit-nextjs";
import Image from "next/image";
import Link from "next/link";

export default async function SignInPage() {
	const clientId = serverEnv.WORKOS_CLIENT_ID;
	const redirectUri = serverEnv.NEXT_PUBLIC_WORKOS_REDIRECT_URI;

	const signInUrl = getWorkOS().userManagement.getAuthorizationUrl({
		clientId,
		redirectUri,
		provider: "GoogleOAuth",
		providerScopes: [
			"openid",
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
			"https://www.googleapis.com/auth/calendar.readonly",
			"https://www.googleapis.com/auth/calendar.events",
			"https://www.googleapis.com/auth/calendar.events.readonly",
		],
		providerQueryParams: {
			access_type: "offline",
			prompt: "consent",
			include_granted_scopes: true,
		},
	});

	return (
		<div className="space-y-6 text-center">
			<div className="flex justify-center">
				<Image
					src="/logo.png"
					alt="Auto Cron logo"
					width={56}
					height={56}
					className="size-14 rounded-xl"
					priority
				/>
			</div>
			<h1 className="text-2xl font-bold">Sign in to Auto Cron</h1>
			<p className="text-muted-foreground">Sign in with your Google account to get started.</p>
			<Link
				href={signInUrl}
				className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground"
			>
				Sign in with Google
			</Link>
		</div>
	);
}
