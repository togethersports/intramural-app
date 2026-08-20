import Link from "next/link";
import { NewGameForm } from "@/app/(app)/league/[slug]/game/new/new-game-form";
import { Lockup } from "@/components/mark";
import { PageHeader } from "@/components/ui";
import { DEFAULT_GAME_RULES } from "@core/game-rules";

/** Living reference for the ad-hoc "New game" form — no auth, no backend;
    submitting does nothing here. */
export default function NewGameReferencePage() {
  return (
    <div className="min-h-screen space-y-5 px-4 py-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between">
        <Link href="/design" aria-label="Design reference home">
          <Lockup size={32} tone="white-red" />
        </Link>
        <p className="label !text-white/80">Fixture data · nothing saves</p>
      </header>
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader
          title="New game"
          subtitle="Any matchup, playable right now — no schedule required."
        />
        <div className="card mt-5 p-6 sm:p-8">
          <NewGameForm
            slug="demo"
            seasonId="demo-season"
            teams={[
              { id: "t1", name: "Warriors" },
              { id: "t2", name: "Hawks" },
              { id: "t3", name: "Titans" },
            ]}
            venues={[
              { id: "v1", name: "Main Gym" },
              { id: "v2", name: "Auxiliary Gym" },
            ]}
            defaults={DEFAULT_GAME_RULES}
          />
        </div>
      </div>
    </div>
  );
}
