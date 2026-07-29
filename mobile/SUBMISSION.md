# Shipping Intramural to the App Store

Everything in this repo is built and typechecked. What remains cannot be
done from a Linux container: compiling, signing, and submitting an iOS app
requires macOS toolchains, and this environment's network policy blocks
Apple's developer endpoints. **You do not need a Mac** — EAS Build compiles
on Expo's cloud macOS machines — but you do have to run the commands from a
machine with normal internet access.

## Before you start

You have an Apple Developer Program membership, so you need three
identifiers. Get them once, then they go in `eas.json`:

| Value | Where to find it |
|---|---|
| Apple ID | The email you enrolled with |
| Team ID | [developer.apple.com/account](https://developer.apple.com/account) → Membership details → Team ID (10 chars) |
| App Store Connect App ID | Created in step 2 below; the numeric `id` in the App Store Connect URL |

## 1. Point the app at Supabase

The mobile app reads its config from environment variables at build time.
Create `mobile/.env` (gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://qayvyjgzfkafrhtchjub.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

For cloud builds, register them as EAS secrets so they are available to the
build machine:

```bash
cd mobile
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://qayvyjgzfkafrhtchjub.supabase.co"
npx eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_..."
```

The anon key is designed to be public — RLS is what protects the data, and
`npm run test:db` proves it is enforced. Do **not** put the service-role key
in the app.

## 2. Create the App Store Connect record

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Apps → **+** → New App
2. Platform **iOS**, Name **Intramural**, Primary language **English (U.S.)**
3. Bundle ID — register `app.intramural.ios` first at
   developer.apple.com → Identifiers, then pick it here.
   (If you want a different bundle ID, change `ios.bundleIdentifier` in
   `mobile/app.json` to match.)
4. SKU — anything unique, e.g. `intramural-ios`

Copy the numeric App ID out of the URL into `eas.json` → `submit.production.ios.ascAppId`.

## 3. Fill in `eas.json`

Replace the three `REPLACE_WITH_...` placeholders with your Apple ID, App
Store Connect App ID, and Team ID.

## 4. Link the project and build

```bash
cd mobile
npm install
npx eas login
npx eas init            # writes extra.eas.projectId into app.json
npx eas build --platform ios --profile production
```

EAS will offer to generate the Distribution Certificate and Provisioning
Profile for you — say yes; it manages them from then on. The build runs on
a hosted macOS machine and takes roughly 10–20 minutes.

To try it on a device first, use `--profile preview` (ad-hoc, needs the
device UDID registered) or `--profile development` with
`npx expo start --dev-client`.

## 5. Submit

```bash
npx eas submit --platform ios --latest
```

## 6. App Store Connect metadata

| Field | Value |
|---|---|
| Category | Sports (secondary: Education) |
| Age rating | **4+** — no objectionable content. Answer "None" to every content question. |
| Privacy Policy URL | `https://<your-domain>/privacy` — the page exists in this repo; it only needs the web app deployed. |
| Support URL | `https://<your-domain>/support` — likewise. |
| Sign in with Apple | **Not required** — the app offers only its own email/password account, no third-party login (Guideline 4.8 applies only if you add Google/Facebook sign-in). |

### Privacy nutrition labels

Declare exactly what the app collects — all of it linked to identity, none
of it used for tracking:

- **Contact Info → Email Address** — App Functionality
- **Contact Info → Name** — App Functionality
- **User Content → Other User Content** (grade, availability, stats) — App Functionality

Answer **No** to "Do you or your third-party partners use data for
tracking?" The app has no analytics SDK, no ads, and no third-party
trackers. `NSPrivacyTracking` is already `false` in `app.json`.

The privacy manifest (`ios.privacyManifests` in `app.json`) declares
`NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1` — required
because AsyncStorage writes to UserDefaults to persist the session.

### The review notes field

Reviewers cannot sign up for a school league on their own — joining needs a
six-character code from a commissioner. **Give them a working demo account
and a join code, or the app will be rejected as unusable.**

`npm run seed:demo` builds one and prints the notes text ready to paste. It
creates a mid-season league — six teams, thirty-six players, a round-robin
schedule with four weeks played and two to come, box scores, a play-by-play,
availability, rules and an inbox — plus a reviewer account that is a
*player*, not a commissioner, so that deleting the account works rather than
being blocked by the still-runs-a-league guard. This is also the league the
App Store screenshots are taken from:

```bash
SUPABASE_SERVICE_ROLE_KEY="..." npm run seed:demo
```

The service-role key is under Project Settings → API. It is an admin key —
it stays out of git and out of the app. Re-running replaces the previous
demo league and leaves everything else alone.

## Review risks, and why this app clears them

- **4.2 Minimum Functionality** — the most common rejection for apps with a
  web counterpart. This is a genuinely native app: React Native views, a
  native tab bar, native fonts, pull-to-refresh, realtime subscriptions. It
  is not a webview wrapper, and there is no `WebView` anywhere in `mobile/`.
- **5.1.1(v) Account Deletion** — required for any app offering account
  creation. Implemented in the **Me** tab, backed by the
  `delete_my_account()` RPC (migration `0008`). It refuses while you still
  commission a league and names the league, so nobody is silently orphaned.
- **5.1.4 / COPPA** — out of scope on the basis that this is a high-school
  (13+) app, which is why the age rating is 4+ rather than the Kids
  Category. **If you later onboard middle schools, this changes**: apps
  directed at under-13s need verifiable parental consent and stricter data
  rules. Revisit before that happens.
- **2.1 Completeness** — see the demo account note above.

## What is deliberately not in v1

The commissioner console, schedule generation, trades, the draft room and
the live stat tracker stay on the web for the first submission. The phone
app is player-first, matching `docs/BRIEF.md`'s rule that "commissioner
surfaces are desktop-dense; player surfaces are mobile-first". The tracker
is the strongest candidate for v2 — it is the one screen that is genuinely
better native (offline queue, haptics, no browser chrome).
