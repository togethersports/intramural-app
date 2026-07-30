# Intramural on Apple Watch

A native watchOS app for the student whose school allows a watch but not a
phone. Four screens, one glance each: **when do I play, what's the schedule,
where do we stand, am I in or out.** The tracker, draft and commissioner
tools stay on web and phone, per the brief's surface rules.

## How it's built

React Native does not run on watchOS, so this is a **SwiftUI application
target** (`targets/watch/`) generated into the Xcode project at prebuild by
`@bacons/apple-targets`. Swift talks to the same Supabase project over plain
REST — same tables, same embedded selects as `lib/data.ts`, same RLS. No
Supabase SDK, no third-party Swift dependencies.

| File | What it is |
|---|---|
| `targets/watch/expo-target.config.js` | Target definition (bundle id `app.intramural.ios.watch`, watchOS 9.4) |
| `targets/watch/Backend.swift` | Keychain, auth, REST queries, standings math, date/clock formatting |
| `targets/watch/Views.swift` | Sign-in, Home, Schedule, Standings, Availability, Me |
| `targets/watch/Theme.swift` | Brandbook constants (cream on Night Court, one red action, mono digits) |
| `app.config.js` | Adds the target **only when `WITH_WATCH=1`** |

## Why the watch signs in by itself

The obvious design — hand the phone's session to the watch — is a trap.
Supabase rotates refresh tokens per session *family*; two devices sharing
one family invalidate each other the first time both refresh, and the
grace interval only hides it for hours. So the watch signs in once with
email/password (dictation or scribble), gets its **own** session, keeps the
refresh token in the keychain, and from then on works fully standalone over
wifi — no phone nearby, which is the whole point.

## The gate

The 1.0 iPhone binary was in App Store review while this was written, so
the watch target is **opt-in per build**: without `WITH_WATCH=1` in the
environment, prebuild produces exactly the project it produced before this
directory existed. Verified both ways from a clean checkout.

- Try it: `npx eas-cli build -p ios --profile simulator-watch`, then pair a
  watch simulator (Simulator → Devices) and install.
- Ship it (v1.1): add `"WITH_WATCH": "1"` to the `production` profile's
  `env` in `eas.json`, bump `version` in app.json, build, submit. EAS
  provisions the extra bundle id automatically (the plugin registers it
  under `extra.eas.build.experimental.ios.appExtensions`).

## Honest status

Swift compiles only on a Mac, and this repo's environment has none — the
code is written to watchOS 9-era APIs and reviewed carefully, but the first
`simulator-watch` build is its first compile. Expect at worst small,
mechanical fixes, not design changes.

## v2 candidates

- WidgetKit complication (`watch-widget` target): next game on the face.
- Notifications via the existing `notifications` table.
- Session handoff from the phone via `WCSession` + a short-lived link code
  minted by an edge function — replaces typing a password on the wrist,
  without sharing a refresh-token family.
- Live score on the wrist during a game (poll the event stream).
