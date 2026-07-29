import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { NewLeagueForm } from "./new-league-form";

export const metadata: Metadata = { title: "Start a league" };

export default function NewLeaguePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Start a league"
        subtitle="Set the identity now — seasons, time slots, and rules come next."
      />
      <div className="card max-w-xl p-6 sm:p-8">
        <NewLeagueForm />
      </div>
    </div>
  );
}
