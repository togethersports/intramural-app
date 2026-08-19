# Running Intramural

Everything the app needs that isn't code. Each section says what breaks if
you skip it — nothing here is required to *build* or *browse* the app, only
to make a particular feature actually do its job.

## 1. Database

Apply `supabase/migrations/*.sql` in filename order, in the Supabase SQL
editor. They are idempotent, so re-running one is safe.

`0014` and `0015` are the newest. `0014` creates two storage buckets; if the
SQL editor can't create the storage policies (it sometimes can't on the free
tier) the migration prints a notice naming exactly which ones to add by hand
under Storage → Policies.

**One-time, after `0015`:** it mirrors `auth.users.email` onto `profiles`
and backfills existing rows. Reminders cannot be addressed without it.

## 2. Google Sign-In

Without this the button appears and returns "Google sign-in isn't switched
on for this league yet."

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth
   client ID** → Web application.
2. Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   — Supabase's callback, not the app's.
3. Supabase → Authentication → Providers → **Google**: paste the client ID
   and secret, enable.
4. Supabase → Authentication → URL Configuration → **Redirect URLs**: add
   `https://your-domain/auth/callback` for the web app, and
   `intramural://auth-callback` for iOS.

**Leave "Confirm email" on.** Account linking — a Google sign-in attaching
to an existing password account with the same address — only happens when
the email is verified. With confirmation off, an unverified match is exactly
the account-takeover case linking must refuse, so Supabase creates a second
account instead.

## 3. Reminders

Three per game per player: 7:15am local on the day, an hour before tip-off,
and ten minutes before. Off until all three of these are set.

### Environment

| Variable | Why |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | The job reads across every league and has no signed-in session to borrow from. **Server-only — never prefix it with `NEXT_PUBLIC`.** |
| `CRON_SECRET` | The job refuses to run without it. Sent as `Authorization: Bearer <secret>`. |
| `NEXT_PUBLIC_SITE_URL` | Links in emails and texts. Without it they point at the per-deploy preview URL, which dies on the next deploy. |

Use whichever of apex or `www` your host treats as **canonical** — the one
that doesn't redirect. Pointing the cron at the redirecting one gets a 401,
not a follow: curl drops the `Authorization` header across a redirect to a
different host, and `www.example.com` is a different host from `example.com`.
`-L` does not help; `--location-trusted` would, but sending your secret to
wherever a redirect happens to lead is not a habit worth having.
| `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` | Email. The from address must be on a domain verified with Resend. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Texts. The from number must be one you own, in E.164. |

Set email but not SMS (or the reverse) and the app just skips the channel it
can't use — it does not error, and it does not silently mark the reminder as
sent, so configuring the other one later still works for future games.

### Schedule

`vercel.json` asks for `/api/cron/reminders` every five minutes. **Vercel's
Hobby plan only runs cron once a day**, which is not enough for "an hour
before" — on Hobby, point an external pinger at it instead:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/reminders
```

every five minutes, from GitHub Actions, cron-job.org, or anything else. The
route works out what is due from the clock, so it does not care what
triggers it or whether a run was missed.

### Timezone

Each league has one, defaulting to `America/New_York`. "7:15 the morning of"
is a wall-clock time in *that* zone. Change it in the `leagues` table if your
school isn't Eastern:

```sql
update leagues set timezone = 'America/Chicago' where slug = 'your-league';
```

### Why it can't double-send

Every (game, player, kind, channel) is written to `reminder_log` — which has
a unique index — *before* the message goes out. Two overlapping runs race on
that insert and exactly one wins. If you want to re-send a reminder for
testing, delete its row.

## 4. AI recaps and Player of the Week

Set `ANTHROPIC_API_KEY`. Without it both still get written — from the box
score, in plainer prose — and the card says "Recap" instead of "Recap ·
written by Claude".

Recaps are written when a game finalizes. `/api/cron/weekly-awards` (daily
in `vercel.json`) catches up anything that was missed and writes one Player
of the Week card per season per run, for the most recent week whose games
are all in.

The model only ever sees facts that were already computed — the box score
plus the run of play from replaying the event log. It is asked to write, not
to infer, so it cannot invent a statistic. The Player of the Week *pick* is
not the model's at all: `impactScore` in `@core/awards` decides, and the
prose only describes.

## 5. Rotate anything you have pasted

The service-role key bypasses RLS entirely. If it has ever been in a chat,
a screenshot, or a commit: Supabase → Project Settings → API → **Reset**.
The anon key is public by design — RLS is what protects the data — and does
not need rotating.

## Checking it works

```bash
# Should be 401 without the secret, and JSON with it.
curl -i https://your-domain/api/cron/reminders
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/reminders
```

A healthy quiet run answers `{"ok":true,"considered":N,"due":0,"sent":0}`.
`due` counts reminders whose moment has passed inside their catch-up window;
`sent` counts messages that actually reached a provider. `alreadyDone` is the
idempotency ledger doing its job, not an error.
