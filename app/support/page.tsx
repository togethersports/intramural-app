import type { Metadata } from "next";
import Link from "next/link";
import { DocPage, List, P, Section } from "@/components/doc-page";
import { LAST_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Support",
  description:
    "How to join a league, fix a wrong score, and get help with Intramural.",
};

export default function SupportPage() {
  return (
    <DocPage eyebrow="Help" title="Support" updated={LAST_UPDATED}>
      <P>
        Intramural runs school intramural sports leagues — drafts, scheduling
        around lunch periods, live stats, standings and playoffs. Most
        questions are one of the ones below. Anything else, write to us.
      </P>

      <Section title="Getting in">
        <List
          items={[
            <>
              <strong className="font-medium text-ink">
                You need a join code.
              </strong>{" "}
              Leagues are private. Your commissioner — usually the teacher or
              student running it — gives you a six-character code. Enter it
              under <strong className="font-medium text-ink">Join</strong>.
            </>,
            <>
              <strong className="font-medium text-ink">
                No code yet?
              </strong>{" "}
              Ask whoever organises intramurals at your school. We cannot issue
              codes for a league we do not run.
            </>,
            <>
              <strong className="font-medium text-ink">
                Starting your own league
              </strong>{" "}
              is done on the web, where the commissioner tools live. Sign in
              and choose <strong className="font-medium text-ink">New league</strong>.
            </>,
          ]}
        />
      </Section>

      <Section title="Common questions">
        <List
          items={[
            <>
              <strong className="font-medium text-ink">
                My stats are wrong.
              </strong>{" "}
              Statistics are entered by the scorekeeper at the game. Ask your
              commissioner to correct the box score — they can edit a finished
              game, and standings recalculate from the change.
            </>,
            <>
              <strong className="font-medium text-ink">
                A game is missing or at the wrong time.
              </strong>{" "}
              Schedules are set by your commissioner. Rescheduling a game
              notifies everyone on both teams.
            </>,
            <>
              <strong className="font-medium text-ink">
                I never got the confirmation email.
              </strong>{" "}
              Check the spam folder first. Signing up repeatedly triggers a
              rate limit and slows things down — wait a few minutes, then try
              once more.
            </>,
            <>
              <strong className="font-medium text-ink">
                Scores are not updating during a game.
              </strong>{" "}
              Live updates need a connection. On patchy school wifi the app
              falls back to refreshing periodically; pull down on the screen to
              force it.
            </>,
          ]}
        />
      </Section>

      <Section title="Deleting your account">
        <P>
          Open the <strong className="font-medium text-ink">Me</strong> tab and
          choose <strong className="font-medium text-ink">Delete account</strong>
          . If you currently run a league, hand it to another commissioner
          first — the app will tell you which league is blocking. See{" "}
          <Link
            className="font-medium text-ink underline underline-offset-4"
            href="/privacy"
          >
            privacy
          </Link>{" "}
          for what gets removed.
        </P>
      </Section>

      <Section title="Contact us">
        <P>
          Email{" "}
          <a
            className="font-medium text-ink underline underline-offset-4"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          . Telling us your school, your league name, and what you expected to
          happen gets you a useful answer on the first reply.
        </P>
      </Section>
    </DocPage>
  );
}
