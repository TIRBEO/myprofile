"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CardGroup, Input } from "@/components/ig-ui";
import { captureReferral, completeSignup } from "@/lib/referrals";
import { startSession } from "@/lib/session";

function LoginForm() {
  const params = useSearchParams();
  const signedOut = params.get("reason") === "inactive";

  // Capture ?ref=CODE from the landing-page invite link
  useEffect(() => {
    const ref = params.get("ref");
    if (ref) captureReferral(ref);
  }, [params]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Simulated signup — award points to the referrer if invited
    completeSignup();
    startSession();
    window.location.href = "/settings";
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-5 py-12">
      <div className="mb-8 text-center">
        <h1
          className="text-4xl font-semibold tracking-tight"
          style={{ fontFamily: "cursive, -apple-system" }}
        >
          Tirbeo
        </h1>
        <p className="mt-3 text-[14px] text-muted">
          Sign in to manage your profile and settings.
        </p>
        {signedOut ? (
          <p className="mt-4 rounded-lg bg-surface-2 px-4 py-2.5 text-[13px] font-medium text-fg">
            You were signed out after an hour of inactivity.
          </p>
        ) : null}
      </div>

      <CardGroup className="mb-0">
        <form className="divide-y divide-divider" onSubmit={handleSubmit}>
          <div className="space-y-3 px-6 py-5">
            <Input type="text" required placeholder="Phone number, username or email" />
            <Input type="password" required placeholder="Password" />
          </div>
          <div className="px-6 py-5">
            <button
              type="submit"
              className="h-11 w-full rounded-lg bg-accent text-[15px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.995]"
            >
              Log in
            </button>
          </div>
        </form>
        <div className="px-6 py-5 text-center">
          <button className="w-full text-[13px] text-muted transition-colors hover:text-fg">
            Forgot password?
          </button>
        </div>
      </CardGroup>

      <CardGroup className="mt-6">
        <div className="px-6 py-5 text-center text-[14px]">
          Don&apos;t have an account?{" "}
          <span className="cursor-pointer font-medium text-accent hover:underline">
            Sign up
          </span>
        </div>
      </CardGroup>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
