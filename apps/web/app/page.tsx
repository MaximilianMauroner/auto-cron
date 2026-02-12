import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { LandingPage } from "./_components/landing-page";

export default async function Home() {
	const { user } = await withAuth();
	if (user) {
		redirect("/calendar");
	}

	return <LandingPage />;
}
