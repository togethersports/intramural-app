import Link from "next/link";
import { Lockup } from "@/components/mark";
import { ThemeStyle } from "@/components/theme-style";
import { DEFAULT_APPEARANCE } from "@core/theme";

/**
 * Sign in and sign up are the first product screen, not the last marketing
 * one, so they are drawn in the shipped app palette. A person's own
 * appearance can't apply here — there is nobody signed in to read it from.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ThemeStyle appearance={DEFAULT_APPEARANCE} />
      <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-8">
          <Lockup size={40} tone="theme" />
        </Link>
        <div className="card w-full max-w-md p-8">{children}</div>
        <p className="mt-6 text-[17px] font-medium text-on-canvas">
          Built for lunch periods everywhere.
        </p>
      </div>
    </>
  );
}
