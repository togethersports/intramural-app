/**
 * Registering this phone for push.
 *
 * The token is the *raw APNs device token*, not an Expo push token — the
 * server sends through Apple directly (lib/notify/apns.ts on the web side),
 * so Expo's relay never enters the picture. `getDevicePushTokenAsync` hands
 * back exactly what Apple issued.
 *
 * Registration runs on every signed-in launch rather than once: Apple can
 * reissue the token after a restore, registration upserts on the token
 * itself, and a device quietly holding a stale registration is the failure
 * nobody ever notices. Silent on every error by design — a phone that can't
 * register is a phone that gets its announcements a little later, not an
 * error worth a dialog.
 */

import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

const SITE =
  process.env.EXPO_PUBLIC_SITE_URL ?? "https://www.intramural.app";

/** Show announcements even while the app is foregrounded — a commissioner's
    "gym closed" must not depend on the app being closed to be seen. */
export function configureForegroundPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function registerForPush(accessToken: string): Promise<void> {
  // Simulators have no APNs; Android would need a different pipeline.
  if (Platform.OS !== "ios") return;
  try {
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted && !perm.ios?.status) return;

    const device = await Notifications.getDevicePushTokenAsync();
    const token = String(device.data);
    // Apple's token is 32 bytes hex; anything else here is a simulator or
    // an Expo Go session, neither of which can receive APNs anyway.
    if (!/^[0-9a-fA-F]{64}$/.test(token)) return;

    await fetch(`${SITE}/api/push/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        token,
        platform: "ios",
        bundleId:
          Constants.expoConfig?.ios?.bundleIdentifier ?? "app.intramural.ios",
      }),
    });
  } catch {
    // Declined permission, no network, misconfigured build — all fine.
  }
}

/** Retire this phone's token on sign-out so the next account on this device
    does not inherit the last one's announcements. */
export async function unregisterForPush(accessToken: string): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const device = await Notifications.getDevicePushTokenAsync();
    const token = String(device.data);
    if (!/^[0-9a-fA-F]{64}$/.test(token)) return;
    await fetch(
      `${SITE}/api/push/register?token=${encodeURIComponent(token)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  } catch {
    // Best-effort: registration upserts on the token, so the next sign-in
    // takes ownership of the row regardless.
  }
}
