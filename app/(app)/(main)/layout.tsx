import { cookies } from "next/headers";
import { Shell, MODE_COOKIE } from "@/components/shell/shell";
import { ThemeStyle } from "@/components/theme-style";
import { getMyProfile } from "@/lib/auth";
import { getUnreadCount } from "@/lib/data";
import { mainNav } from "@/lib/nav";
import { DEFAULT_APPEARANCE, parseAppearance } from "@core/theme";

/** Everything signed in that isn't inside a league: leagues list, inbox,
 *  profile, join, create. Drawn in the person's own palette. */
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, unread, jar] = await Promise.all([
    getMyProfile(),
    getUnreadCount(),
    cookies(),
  ]);
  const appearance = parseAppearance(profile?.appearance, DEFAULT_APPEARANCE);
  const mode = jar.get(MODE_COOKIE)?.value === "commish" ? "commish" : "player";

  return (
    <>
      <ThemeStyle appearance={appearance} />
      <Shell
        identity={{
          href: "/dashboard",
          name: "Intramural",
          eyebrow: "Your leagues",
          logoUrl: null,
          color: "var(--color-accent)",
          mark: true,
        }}
        nav={{ player: mainNav(), commish: null }}
        badges={{ inbox: unread }}
        user={{
          name: profile?.full_name ?? "Player",
          avatarUrl: profile?.avatar_url ?? null,
          roleLine: "Your account",
        }}
        initialMode={mode}
        screen={{ kind: "main" }}
      >
        {children}
      </Shell>
    </>
  );
}
