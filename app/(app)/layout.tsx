import { AppShell } from "@/components/shell/app-shell";
import { getMyName, requireUser } from "@/lib/auth";
import { getUnreadCount } from "@/lib/data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const [name, unread] = await Promise.all([getMyName(), getUnreadCount()]);

  return (
    <AppShell name={name} unread={unread}>
      {children}
    </AppShell>
  );
}
