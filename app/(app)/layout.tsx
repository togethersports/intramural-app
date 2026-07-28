import { AppShell } from "@/components/shell/app-shell";
import { requireUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, unread] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    getUnreadCount(),
  ]);

  const name =
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email ||
    "Player";

  return (
    <AppShell name={name} unread={unread}>
      {children}
    </AppShell>
  );
}
