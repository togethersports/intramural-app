import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join a league" };

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Join a league"
        subtitle="Got a code? You'll be on the roster in ten seconds."
      />
      <div className="card max-w-md p-6 sm:p-8">
        <JoinForm defaultCode={code} />
      </div>
    </div>
  );
}
