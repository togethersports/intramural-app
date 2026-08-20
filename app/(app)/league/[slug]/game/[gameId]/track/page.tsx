import { redirect } from "next/navigation";

/** The old tracker route — superseded by the live console. Kept as a
    redirect so bookmarks and already-sent notification links still work. */
export default async function TrackPage({
  params,
}: {
  params: Promise<{ slug: string; gameId: string }>;
}) {
  const { slug, gameId } = await params;
  redirect(`/league/${slug}/game/${gameId}/live`);
}
