import Link from "next/link";
import { Logo } from "@/components/ui";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8 text-white">
        <Logo />
      </Link>
      <div className="card w-full max-w-md p-6 sm:p-8">{children}</div>
      <p className="mt-6 text-sm text-white/70">
        Built for lunch periods, free periods, and after school.
      </p>
    </div>
  );
}
