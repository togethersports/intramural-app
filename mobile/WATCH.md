# Intramural on Apple Watch

Phones are off between 8 and 4. For those eight hours the watch is not a
companion to the app — it *is* the app. That premise decides what belongs
here: not just "when do I play", but everything a student has to **do**
during the day, each of it resolving in one or two taps.

| Screen | What it's for |
|---|---|
| **Today** | The default. Next game, counting down, with the gym. The one screen the whole app exists for. |
| **Live** | Score and your own line, read-only. Scorekeepers get a three-tap stat entry behind it. |
| **Standings** | Rank, record, your team pinned. |
| **Polls** | Vote on a proposed slot. One tap. |
| **Availability** | The per-period in/maybe/out grid. |
| **Me** | League, team, last sync, sign out. |

Off the wrist on purpose, per the brief's surface rules: the draft, full
box-score entry, recap prose (Today shows a one-line result and says "full
recap on the app"), and anything needing typed text.

## How it's built

React Native does not run on watchOS, so this is a **SwiftUI application
target** (`targets/watch/`) generated into the Xcode project at prebuild by
`@bacons/apple-targets`. Swift talks to the same Supabase project over plain
REST — same tables, same embedded selects as `lib/data.ts`, same RLS. No
Supabase SDK, no third-party Swift dependencies.

| File | What it is |
|---|---|
| `Backend.swift` | Keychain, auth, the REST verbs, standings math, date/clock formatting |
| `Store.swift` | Disk cache and the one observable everything reads from |
| `Live.swift` | Event replay for the live score, roster, stat logging |
| `Season.swift` | Absences, sub requests, scheduling polls |
| `Notifications.swift` | Local tip-off notices, background wake |
| `Views.swift` | Every screen |
| `Theme.swift` | Court palette and the shared card/button/eyebrow pieces |

## Why the watch signs in by itself

The obvious design — hand the phone's session to the watch — is a trap.
Supabase rotates refresh tokens per session *family*; two devices sharing
one family invalidate each other the first time both refresh, and the grace
interval only hides it for hours. So the watch signs in once with
email/password (dictation or scribble), gets its **own** session, keeps the
refresh token in the keychain, and from then on works standalone over wifi —
no phone nearby, which is the whole point.

## Why the score is replayed, not read

`games.home_score` exists, and the watch ignores it. Score comes from
replaying `game_events`, the same way the web console and the recap writer
derive it. The event log is the fact; the column is a cache of it. That is
what makes a watch, a phone and a laptop watching the same game agree.

Undo **voids** rather than deletes, so the log stays append-only and every
device recomputes to the same number. Every write carries a `client_uuid`
against the `(game_id, client_uuid)` unique index, so a retry on bad gym wifi
lands on the same row instead of scoring twice.

## Why the notifications are local

There is no APNs in this project — no key, no device-token table — and
adding one is a bigger change than this app. More to the point, a push has
to travel phone → watch, and the premise is that the phone is in a drawer at
home.

So the three tip-off notices (7:15am, an hour out, ten minutes out — the
same offsets as `@core/reminders`) are scheduled **on the watch** from the
fixtures it already caches. They fire in airplane mode in a basement gym,
which is exactly where they're needed and exactly where a push would not
arrive.

**The limitation this leaves is real.** Anything the *server* learns that
the watch cannot derive — a captain approving your sub, a teammate dropping
out — cannot interrupt the student. `WKApplicationRefreshBackgroundTask`
narrows the gap by polling on wake and raising a local notice, but watchOS
decides when that runs: think "within the hour", not "within the minute".
Genuinely instant alerts need APNs, and that is a backend change.

## Why everything renders from disk first

A school gym is a wifi dead spot and the watch is the only device the
student has, so no screen shows a spinner where it could show yesterday's
answer. `Store` hydrates from disk synchronously before a byte moves, then
reconciles. A failed refresh with cached fixtures on screen is **not** an
error — it does not become one. What every cached screen does carry is a
sync line, because cached data presented as current is the one failure that
actually strands somebody in the wrong gym.

## The approval rules are the database's, not the watch's

`decide_sub_request` and `claim_sub_request` are security-definer RPCs
because both encode *transitions* — "only a proposed request may be
approved", "only the opposing captain may approve it" — which a row policy
structurally cannot express: a policy cannot see the previous row, and
cannot see a value the caller is about to write. The watch calls the same
functions the web does and surfaces whatever they raise. It does not
re-derive the rules, so it cannot disagree with them.

## The gate

The watch target is **opt-in per build**: without `WITH_WATCH=1` in the
environment, prebuild produces exactly the project it produced before this
directory existed. Two profiles set it, and the phone-only profiles are
untouched so there is always a way to ship without the watch:

| Profile | What it makes |
|---|---|
| `simulator-watch` | Release build for a paired watch simulator |
| `production-watch` | App Store build, iPhone app **with** the watch app inside it |

Never run EAS from the repo root — it must be `mobile/`.

## Checking the Swift without a Mac

`node scripts/check-swift.mjs` parses every file in the target against a
real Swift grammar and reports syntax errors with line numbers. It needs a
parser it deliberately does not depend on:

```
npm i --no-save tree-sitter tree-sitter-swift
node scripts/check-swift.mjs
```

It is **not** a compiler — it knows nothing about types, member names or
platform availability. What it buys is that the first cloud build fails on
something interesting rather than a missing brace. Run it after any edit
here.

## Getting it into review

1. `node scripts/check-swift.mjs` — catch the cheap mistakes first.
2. `npx eas-cli build -p ios --profile simulator-watch` from `mobile/`.
   **This is the first real compile.** Fix whatever it says.
3. Install on a paired watch simulator (Simulator → Devices → pair a watch)
   and walk every screen.
4. Decide the version in `app.json`. If 1.0.0 has shipped, bump to 1.1.0.
   If 1.0.0 is still unreleased, leave it — the build number auto-increments
   and the watch just becomes part of what 1.0.0 is.
5. `npx eas-cli build -p ios --profile production-watch`
6. `npx eas-cli submit -p ios --profile production`

EAS provisions the extra bundle id (`app.intramural.ios.watch`)
automatically — the plugin registers it under
`extra.eas.build.experimental.ios.appExtensions`.

**Do not add a `PrivacyInfo.xcprivacy` to `targets/watch/`.** The watch app
bundle already receives one, and a second copy fails the build outright:

```
Multiple commands produce .../Release-watchsimulator/Intramural.app/PrivacyInfo.xcprivacy
```

That error is also the proof — Xcode can only report *multiple* producers if
one was already there. The plugin registers the target as an Xcode 16
synchronized folder group (`PBXFileSystemSynchronizedRootGroup`), so every
file dropped into this directory becomes a target member automatically; a
manifest added by hand is therefore a duplicate rather than an addition.
Declare privacy in `privacyManifests` in **app.json** and the watch inherits
it.

Worth knowing for that declaration: the watch touches none of the
required-reason APIs. No `UserDefaults` (CA92.1), and no file-timestamp
reads (C617.1) — the disk cache stamps its own `at` inside the JSON envelope
rather than asking the filesystem when a file was written.

App Store Connect will also want a watch screenshot for the listing. Take
it from the simulator in step 3.

## Honest status

**Swift compiles only on a Mac, and this repo's environment has none.** So:

- Every file **parses** against a real Swift grammar — that check found two
  things by machine that the eye had missed, one of them a genuine compile
  error (`await` inside a `for … where` clause, which Swift forbids).
- Availability was reviewed **by hand**, which caught
  `navigationBarTitleDisplayMode` — an iOS-only modifier used in eight
  places that would have failed the first build.
- Nothing has **type-checked**. That is what step 2 above is for, and it is
  the step that cannot be skipped or simulated.

Expect small mechanical fixes there, not design changes. Paste the error and
it is usually a one-liner.

Two things only a real device will settle: whether watchOS grants the
background refresh often enough to be worth having, and whether the stat
tapper's targets survive a sleeve over the wrist.

## Still to do

- WidgetKit complication: next game on the face, which is the one place
  glanceability could still improve.
- APNs, if instant sub alerts turn out to matter more than the poll allows.
- Session handoff from the phone via a short-lived link code, replacing the
  one password entry on the wrist.
