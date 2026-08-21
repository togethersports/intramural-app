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
| `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` | Email. The from address must be on a domain verified with Resend. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Texts. The from number must be one you own, in E.164. |

For the domain, use whichever of apex or `www` your host treats as
**canonical** — the one that doesn't redirect. Pointing the cron at the
redirecting one gets a 401, not a follow: curl drops the `Authorization`
header across a redirect to a different host, and `www.example.com` is a
different host from `example.com`. `-L` does not help; `--location-trusted`
would, but sending your secret to wherever a redirect happens to lead is not
a habit worth having. The same applies to Supabase's **Site URL** and
**Redirect URLs** — a mismatch there sends people to `localhost` after they
sign in with Google.

Set email but not SMS (or the reverse) and the app just skips the channel it
can't use — it does not error, and it does not silently mark the reminder as
sent, so configuring the other one later still works for future games.

### Schedule

`vercel.json` is written for **Hobby**, whose limits are two cron jobs, each
running at most once a day. A more frequent schedule there is not merely
ignored — Vercel **rejects the deployment**, so the whole site stops
updating. If you ever see "Deployment failed" right after touching
`vercel.json`, this is the first thing to check.

Once a day cannot deliver "an hour before tip-off", so on Hobby the daily
Vercel cron is only a backstop and something else drives the real cadence.
`.github/workflows/reminders.yml` does it, hitting the route every five
minutes. Add `CRON_SECRET` under repo Settings → Secrets and variables →
Actions and it starts working.

The backstop is timed to be worth having on its own: `30 12 * * *` is 8:30am
Eastern in summer and 7:30am in winter, which falls inside the 7:15am
notice's 90-minute catch-up window in **both** halves of the year. So even
with GitHub Actions completely down, the morning reminders still go out. The
hour-before and ten-minute ones do not — nothing daily could send those.

Retune that number if your leagues are not Eastern; the window you need to
land in is 7:15–8:45 local, converted to UTC in *both* DST states.

**On Pro**, set the reminders schedule to `*/5 * * * *` and delete
`.github/workflows/reminders.yml` — Vercel does the whole job. Nothing else
changes, and running both is harmless in the meantime.

The route works out what is due from the clock, so it does not care what
triggers it, how often, or whether a run was missed:

```
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/reminders
```

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

## 4. The school's period grid

Games are scheduled into *time slots*, and a slot is one period on one
weekday — so a period that runs Monday to Thursday is four rows, not one.

`supabase/seed/period-slots.sql` loads them in one paste. Put your league's
slug in the two marked places and run it in the SQL editor; it prints the
grid it produced so you can check it against the timetable.

It seeds only the periods a game can actually be played in — FLEX every day,
and lunch Monday to Thursday. The rest of the day is class, and seeding it
would only give everyone nine more rows to mark themselves busy in. Console →
Time slots adds one by hand if a season needs it.

It never deletes. `availability.time_slot_id` cascades, so removing a slot
takes every player's answer about when they are free with it — which is why
re-running the file skips periods that already exist rather than replacing
them, and why fixing a time is the UPDATE at the bottom of the file.

## 5. Push notifications

Optional, and the app is honest without it: no keys means push reports "not
configured" and email and SMS carry on.

| Variable | Where it comes from |
|---|---|
| `APNS_KEY_P8` | Apple Developer → Certificates, Identifiers & Profiles → **Keys** → **+** → tick **Apple Push Notifications service**. The `.p8` downloads **once** — save it. Paste the file's contents with newlines written as `\n`. |
| `APNS_KEY_ID` | The 10-character Key ID shown beside the key you just made. |
| `APNS_TEAM_ID` | Apple Developer → Membership. Ten characters. |

Apply migration `0016` too — it creates `device_tokens` and widens
`reminder_log.channel` to accept `push`.

### What push is and isn't for

**The three tip-off notices do not use it, deliberately.** The watch
schedules those locally from the fixtures it has already cached, so they
fire in a basement gym with no signal — precisely where a push would not
arrive. Push exists for what the watch *cannot* derive: a captain approving
a sub, a teammate flagging out.

Only the ten-minute notice is sent `time-sensitive`, so it breaks through a
Focus. The morning one can wait until someone looks at their wrist.

### Who gets it

A device registers itself against the signed-in account at
`/api/push/register`, which writes under RLS as the caller — this route
never touches the service-role key. Push is then added to whatever channels
that person already gets, for any preference except `none`. `none` stays a
global mute: someone who turned everything off does not get buzzed on the
wrist because the watch app happens to be installed.

It is deliberately *not* one of the four `notify_channel` values. Those are
about addresses we have to be given; a registered device is consent already
expressed by installing the app and allowing notifications.

### Dead tokens

Apple answers `410 Unregistered` (or `400 BadDeviceToken`) when an app is
deleted or restored elsewhere. The sender marks that row `invalidated_at`
rather than deleting it, so a device that comes back is distinguishable from
one never seen — and the cron stops sending to it, which is what keeps the
sender off Apple's throttle list.

Registration upserts on the **token**, not on (user, token). A watch that
changes hands therefore moves to its new owner rather than accumulating a
row per person, which is what actually stops anyone inheriting someone
else's notifications.

## 6. AI recaps and Player of the Week

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

## 7. Rotate anything you have pasted

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
