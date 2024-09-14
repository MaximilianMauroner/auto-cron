import type { Metadata } from "next";
import SignInForm from "./signing-form";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getServerAuthSession } from "@/server/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignPage() {
  const session = await getServerAuthSession();
  if (session) {
    redirect("/dashboard");
    return;
  }
  return (
    <div className="m-auto flex h-screen">
      <Card className="m-auto block max-w-sm p-5">
        <CardHeader>
          <CardTitle className="text-2xl">AutoCron</CardTitle>
          <CardDescription>Log into AutoCon using Google</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
    </div>
  );
}
