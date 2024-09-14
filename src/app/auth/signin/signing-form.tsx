"use client";
import { signIn } from "next-auth/react";

import Image from "next/image";

export default function SignInForm() {
  return (
    <>
      <div className="grid gap-4">
        <button onClick={() => void signIn("google")}>
          <Image
            src={"/google.svg"}
            alt={"google logo"}
            width={250}
            height={250}
            className="w-64"
          />
        </button>
      </div>
    </>
  );
}
