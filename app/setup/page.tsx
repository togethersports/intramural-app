import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage() {
  const configured = isSupabaseConfigured();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-white">
        <Logo />
      </Link>
      <div className="card w-full max-w-xl space-y-4 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Connect the backend
        </h1>
        {configured ? (
          <p className="rounded-control bg-ink px-4 py-3 text-sm font-medium text-white">
            Supabase is configured. You&apos;re good to go —{" "}
            <Link href="/signup" className="underline">
              create an account
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-body">
              This app uses Supabase for auth and data. To run it, create a
              Supabase project, apply the migrations in{" "}
              <code className="rounded bg-rule px-1.5 py-0.5 text-[13px]">
                supabase/migrations/
              </code>
              , and add these to <code className="rounded bg-rule px-1.5 py-0.5 text-[13px]">.env.local</code>:
            </p>
            <pre className="overflow-x-auto rounded-panel bg-ink p-4 text-[13px] leading-relaxed text-surface">
              {`NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`}
            </pre>
            <p className="text-sm text-ink-body">
              Full instructions are in the repo README.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
