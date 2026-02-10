export default function SignInPage() {
	return (
		<div className="space-y-6 text-center">
			<h1 className="text-2xl font-bold">Sign in to Auto Cron</h1>
			<p className="text-muted-foreground">Sign in with your Google account to get started.</p>
			{/* TODO: Add WorkOS AuthKit sign-in button */}
			<button
				type="button"
				className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground"
			>
				Sign in with Google
			</button>
		</div>
	);
}
