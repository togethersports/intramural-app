import type { Metadata } from "next";
import Link from "next/link";
import { DocPage, List, P, Section } from "@/components/doc-page";
import { LAST_UPDATED, SUPPORT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Intramural collects, who can see it, and how to delete your account.",
};

export default function PrivacyPage() {
  return (
    <DocPage eyebrow="Legal" title="Privacy policy" updated={LAST_UPDATED}>
      <P>
        Intramural runs school intramural sports leagues. It is used by
        students and the teachers who run their leagues, so it collects as
        little as a league can function on. This page says exactly what that
        is, in plain terms.
      </P>

      <Section title="What we collect">
        <List
          items={[
            <>
              <strong className="font-medium text-ink">
                Your name and email address.
              </strong>{" "}
              Needed to sign you in and to show teammates who is on the roster.
            </>,
            <>
              <strong className="font-medium text-ink">Your grade</strong>, if
              you enter it. Optional, and used only to sort rosters.
            </>,
            <>
              <strong className="font-medium text-ink">
                Profile details you choose to add
              </strong>{" "}
              — height, jersey number preference, positions, profile photo.
              All optional.
            </>,
            <>
              <strong className="font-medium text-ink">
                Your availability
              </strong>{" "}
              — which lunch periods and after-school slots you mark yourself
              in, maybe, or out for.
            </>,
            <>
              <strong className="font-medium text-ink">
                Your game statistics
              </strong>{" "}
              — points, rebounds, assists and the rest, recorded by whoever is
              keeping score at your games.
            </>,
          ]}
        />
      </Section>

      <Section title="What we do not collect">
        <P>
          No location. No contacts. No browsing history. No advertising
          identifiers. Intramural contains no analytics SDK, no ad network,
          and no third-party trackers, so nothing you do here is used to
          profile you or follow you onto other apps and websites. We do not
          sell your data, and we do not share it with anyone for advertising.
        </P>
      </Section>

      <Section title="Who can see your information">
        <P>
          Your name, grade, availability and statistics are visible to other
          members of the leagues you join, and to the commissioner who runs
          them. That is the point of a league — teammates need to see the
          roster and the box score.
        </P>
        <P>
          People outside your league cannot see any of it. This is enforced by
          the database itself through row-level security, not merely hidden in
          the interface, and the rules are covered by an automated test suite
          that runs as an ordinary signed-in user.
        </P>
      </Section>

      <Section title="Where it is stored">
        <P>
          Data is stored with Supabase, which hosts it on Amazon Web Services.
          Connections are encrypted in transit. On your phone, the app keeps a
          sign-in token in the device&apos;s own protected storage so you are
          not asked to log in every time you open it.
        </P>
      </Section>

      <Section title="Deleting your account">
        <P>
          Open the <strong className="font-medium text-ink">Me</strong> tab in
          the iOS app and choose{" "}
          <strong className="font-medium text-ink">Delete account</strong>. It
          asks you to confirm, then removes your account along with your
          profile, availability, statistics and league memberships. This is
          immediate and cannot be undone.
        </P>
        <P>
          One exception: if you still run a league as commissioner, deletion is
          refused and names the league. Making someone else commissioner first
          keeps that league usable for everyone in it. You can also write to{" "}
          <a
            className="font-medium text-ink underline underline-offset-4"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          and ask us to delete your account for you.
        </P>
      </Section>

      <Section title="Age">
        <P>
          Intramural is built for high-school leagues and is not directed at
          children under 13. If you believe a child under 13 has created an
          account, write to us and we will remove it.
        </P>
      </Section>

      <Section title="Changes">
        <P>
          If this policy changes in a way that affects what we collect or who
          can see it, the date at the top of this page changes with it.
        </P>
      </Section>

      <Section title="Contact">
        <P>
          Questions about any of this go to{" "}
          <a
            className="font-medium text-ink underline underline-offset-4"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          . There is more on getting help at{" "}
          <Link
            className="font-medium text-ink underline underline-offset-4"
            href="/support"
          >
            support
          </Link>
          .
        </P>
      </Section>
    </DocPage>
  );
}
