import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { getMyProfile, requireUser } from "@/lib/auth";
import { getMyLeagues } from "@/lib/leagues";
import { DEFAULT_APPEARANCE, parseAppearance } from "@core/theme";
import {
  DetailsForm,
  MyAppearanceForm,
  NotifyForm,
  PhotoForm,
} from "./profile-forms";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  await requireUser();
  const [profile, leagues] = await Promise.all([getMyProfile(), getMyLeagues()]);

  // Positions are per sport, and a person can be in leagues of different
  // ones. Offer the sport they play most; the rest still render their own.
  const sport = leagues[0]?.sport ?? "basketball";
  const overriding = Object.keys(profile?.appearance ?? {}).length > 0;
  const appearance = parseAppearance(profile?.appearance, DEFAULT_APPEARANCE);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel eyebrow="How you show up" title="Your photo">
          <PhotoForm
            name={profile?.full_name ?? "Player"}
            avatarUrl={profile?.avatar_url ?? null}
          />
        </Panel>

        <Panel eyebrow="Where you play" title="Your leagues">
          {leagues.length === 0 ? (
            <p className="text-[15px] text-ink-body">
              You are not in a league yet.{" "}
              <Link href="/join" className="font-semibold underline">
                Join one with a code
              </Link>
              , or{" "}
              <Link href="/leagues/new" className="font-semibold underline">
                start your own
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {leagues.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/league/${l.slug}`}
                    className="db-row flex min-h-11 items-center gap-3 rounded-panel px-3 py-2.5"
                  >
                    <span
                      aria-hidden
                      className="grid size-9 shrink-0 place-items-center rounded-[10px] text-[14px] font-semibold text-white"
                      style={{ backgroundColor: l.primary_color }}
                    >
                      {l.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {l.name}
                    </span>
                    <span className="label !text-[10px]">{l.role}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel eyebrow="On the roster" title="Name, grade and position">
        <DetailsForm
          sport={sport}
          profile={{
            full_name: profile?.full_name ?? "",
            grade: profile?.grade ?? null,
            height_in: profile?.height_in ?? null,
            jersey_pref: profile?.jersey_pref ?? null,
            positions: profile?.positions ?? [],
          }}
        />
      </Panel>

      <Panel eyebrow="Before every game" title="Reminders">
        <NotifyForm
          channel={
            (profile?.notify_channel as
              | "email"
              | "sms"
              | "both"
              | "none") ?? "email"
          }
          phone={profile?.phone ?? ""}
          email={profile?.email ?? null}
        />
      </Panel>

      <Panel eyebrow="Just for you" title="Colours">
        <MyAppearanceForm
          preset={appearance.preset}
          accent={appearance.accent}
          overriding={overriding}
        />
      </Panel>
    </div>
  );
}
