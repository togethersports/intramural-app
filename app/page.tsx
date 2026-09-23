import { LandingPage } from "@/components/landing-page";
import { getUser } from "@/lib/auth";

export default async function Home() {
  const user = await getUser();
  return (
    <LandingPage
      signedIn={Boolean(user)}
      startHref={user ? "/leagues/new" : "/signup"}
      joinHref={user ? "/join" : "/login"}
    />
  );
}
