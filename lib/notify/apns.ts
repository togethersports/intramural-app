/**
 * Push, straight to Apple.
 *
 * Unlike email and SMS this cannot be a `fetch`: APNs speaks HTTP/2 only and
 * refuses HTTP/1.1 outright, so it uses `node:http2` directly. That is also
 * why this lives in its own file rather than beside Resend and Twilio — the
 * connection has a lifecycle, and mixing that into a module of one-shot POSTs
 * would make the simple cases look complicated.
 *
 * Authentication is a signed JWT rather than a certificate: ES256 over
 * {iss: team, iat} with a kid header, which Apple accepts for an hour. We
 * cache it for fifty-five minutes because Apple rate-limits token *minting*
 * — a new token per push earns a 429 and, if you keep going, a ban.
 *
 * Same contract as every other sender here: never throws, reports `skipped`
 * with the missing variable when unconfigured. The reminder cron runs on a
 * schedule whether or not anyone has set up push.
 */

import { createSign } from "node:crypto";
import { connect, constants } from "node:http2";
import type { DeliveryResult } from "./index";

/** Apple's production host. Sandbox is only for debug builds from Xcode. */
const HOST = "https://api.push.apple.com";

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY_P8 &&
      process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID,
  );
}

/* ------------------------------------ jwt --------------------------------- */

let cached: { token: string; mintedAt: number } | null = null;

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Apple rejects a token older than an hour and rate-limits minting new ones,
 * so this deliberately reuses one for 55 minutes rather than signing per send.
 */
function authToken(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cached && now - cached.mintedAt < 55 * 60) return cached.token;

  const keyId = process.env.APNS_KEY_ID!;
  const teamId = process.env.APNS_TEAM_ID!;
  // Env vars cannot hold real newlines, so the PEM is stored with literal
  // \n and restored here — the same trick the Firebase and Google SDKs use.
  const key = process.env.APNS_KEY_P8!.replace(/\\n/g, "\n");

  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = base64url(JSON.stringify({ iss: teamId, iat: now }));
  const signer = createSign("SHA256");
  signer.update(`${header}.${payload}`);
  // ES256 means the JOSE fixed-width r||s form, not the DER that OpenSSL
  // emits by default. Getting this wrong yields a well-formed token Apple
  // rejects with 403 InvalidProviderToken, which is a miserable thing to
  // debug — hence `dsaEncoding`.
  const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" });

  const token = `${header}.${payload}.${base64url(signature)}`;
  cached = { token, mintedAt: now };
  return token;
}

/** Exported for the tests: a signed token has to be re-minted after an hour. */
export function _resetTokenCache(): void {
  cached = null;
}

/* ----------------------------------- send --------------------------------- */

export interface PushMessage {
  /** Hex device token from `device_tokens`. */
  to: string;
  /** The target app's bundle id — the watch app's, not the phone's. */
  topic: string;
  title: string;
  body: string;
  /** Deep link the tap should open, carried through as custom data. */
  path?: string;
  /**
   * `time-sensitive` breaks through a Focus, which "tip-off in 10 minutes"
   * has earned and "poll closed" has not.
   */
  urgent?: boolean;
}

/**
 * A 410 means Apple has retired the token: the app was deleted or restored
 * onto another device. The caller is expected to act on `unregistered` by
 * marking the row invalidated, because continuing to send to a dead token is
 * how a sender gets throttled.
 */
export interface PushResult {
  result: DeliveryResult;
  unregistered: boolean;
}

export async function sendPush(msg: PushMessage): Promise<PushResult> {
  if (!isPushConfigured()) {
    return {
      unregistered: false,
      result: {
        ok: true,
        skipped: true,
        detail: "Push not configured — set APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID.",
      },
    };
  }

  const payload = JSON.stringify({
    aps: {
      alert: { title: msg.title, body: msg.body },
      sound: "default",
      "interruption-level": msg.urgent ? "time-sensitive" : "active",
    },
    ...(msg.path ? { path: msg.path } : {}),
  });

  return new Promise<PushResult>((resolve) => {
    const done = (result: DeliveryResult, unregistered = false) =>
      resolve({ result, unregistered });

    let session: ReturnType<typeof connect>;
    try {
      session = connect(HOST);
    } catch (e) {
      return done({
        ok: false,
        skipped: false,
        detail: `Could not reach APNs: ${(e as Error).message}`,
      });
    }

    // Without this a network blip leaves the cron holding an open socket
    // until the platform kills the whole invocation.
    const timer = setTimeout(() => {
      session.destroy();
      done({ ok: false, skipped: false, detail: "APNs timed out after 10s." });
    }, 10_000);

    const finish = (result: DeliveryResult, unregistered = false) => {
      clearTimeout(timer);
      session.close();
      done(result, unregistered);
    };

    session.on("error", (e) =>
      finish({ ok: false, skipped: false, detail: `APNs socket: ${e.message}` }),
    );

    const req = session.request({
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${msg.to}`,
      authorization: `bearer ${authToken()}`,
      "apns-topic": msg.topic,
      "apns-push-type": "alert",
      // 10 = deliver now. 5 would let Apple hold it to save battery, which
      // is the wrong trade for a notice that expires when the game starts.
      "apns-priority": "10",
      "content-type": "application/json",
    });

    let status = 0;
    let body = "";
    req.on("response", (headers) => {
      status = Number(headers[constants.HTTP2_HEADER_STATUS] ?? 0);
    });
    req.setEncoding("utf8");
    req.on("data", (chunk) => (body += chunk));
    req.on("error", (e) =>
      finish({ ok: false, skipped: false, detail: `APNs request: ${e.message}` }),
    );
    req.on("end", () => {
      if (status === 200) {
        finish({ ok: true, skipped: false, detail: "Delivered to APNs." });
        return;
      }
      const reason = parseReason(body) ?? `HTTP ${status}`;
      // 410 Unregistered, and 400 BadDeviceToken, both mean this token is
      // never going to work again. Everything else might be transient.
      const dead =
        status === 410 ||
        reason === "Unregistered" ||
        reason === "BadDeviceToken";
      finish(
        { ok: false, skipped: false, detail: `APNs rejected it: ${reason}` },
        dead,
      );
    });

    req.end(payload);
  });
}

/** Apple's error body is `{"reason":"BadDeviceToken"}`, or empty on success. */
export function parseReason(body: string): string | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { reason?: string };
    return parsed.reason ?? null;
  } catch {
    return null;
  }
}
