import { NextResponse } from "next/server";

/**
 * Who is allowed to run a scheduled job.
 *
 * These routes read across every league with the service role, so they must
 * not be openly callable. Two callers are accepted:
 *
 *   - Vercel Cron, which signs its requests with `CRON_SECRET` in the
 *     Authorization header.
 *   - Anything else holding the same secret — a GitHub Action, an external
 *     pinger — because Vercel's Hobby plan only schedules once a day, and
 *     "one hour before tip-off" needs a finer cadence than that.
 *
 * With no secret set the route refuses rather than running open. A job that
 * silently accepts anonymous callers is worse than one that is switched off.
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "CRON_SECRET is not set. Add it to the server environment and send it as `Authorization: Bearer <secret>` — the job refuses to run unauthenticated.",
      },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(request.url).searchParams.get("secret") ?? "";

  if (!timingSafeEqual(bearer, secret) && !timingSafeEqual(query, secret)) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }
  return null;
}

/** Constant-time compare, so a wrong secret leaks nothing through timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
