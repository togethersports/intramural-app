import Link from "next/link";
import { Lockup } from "@/components/mark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8">
        <Lockup size={40} tone="white-red" />
      </Link>
      <div className="card w-full max-w-md p-8">{children}</div>
      <p className="mt-6 text-[17px] font-medium text-white">
        Built for lunch periods everywhere.
      </p>
    </div>
  );
}
