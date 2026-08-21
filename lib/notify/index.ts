/**
 * Getting a message to a person outside the app.
 *
 * Two providers, one shape. Both are plain `fetch` against a documented REST
 * endpoint rather than an SDK — the payloads are four fields each, and a
 * dependency that only ever posts a form body is not worth the install.
 *
 * Every function here is safe to call with nothing configured: it reports
 * `skipped` and says which variable is missing. That matters because the
 * reminder cron runs on a schedule whether or not anyone has set up email
 * yet, and a job that throws every five minutes is a job people turn off.
 */

export type Channel = "email" | "sms" | "push";

export type DeliveryResult =
  | { ok: true; skipped: false; detail: string }
  | { ok: true; skipped: true; detail: string }
  | { ok: false; skipped: false; detail: string };

const skipped = (detail: string): DeliveryResult => ({
  ok: true,
  skipped: true,
  detail,
});

/* ---------------------------------- email --------------------------------- */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL);
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<DeliveryResult> {
  if (!isEmailConfigured()) {
    return skipped(
      "Email not configured — set RESEND_API_KEY and REMINDER_FROM_EMAIL.",
    );
  }
  if (!to.includes("@")) return skipped(`No usable email address (${to}).`);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.REMINDER_FROM_EMAIL,
        to: [to],
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, skipped: false, detail: `Resend ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true, skipped: false, detail: "sent" };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      detail: `Resend request failed: ${(err as Error).message}`,
    };
  }
}

/* ----------------------------------- sms ---------------------------------- */

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

/**
 * Normalise a typed-in number to E.164, which is the only shape Twilio
 * accepts. A US ten-digit number is by far the common case here, so it gets
 * the +1; anything already carrying a + is left alone.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function sendSms({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<DeliveryResult> {
  if (!isSmsConfigured()) {
    return skipped(
      "SMS not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER.",
    );
  }
  const number = toE164(to);
  if (!number) return skipped(`Not a usable phone number (${to}).`);

  const sid = process.env.TWILIO_ACCOUNT_SID!;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: number,
          From: process.env.TWILIO_FROM_NUMBER!,
          Body: body,
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      return { ok: false, skipped: false, detail: `Twilio ${res.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true, skipped: false, detail: "sent" };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      detail: `Twilio request failed: ${(err as Error).message}`,
    };
  }
}

/* --------------------------------- routing -------------------------------- */

export type NotifyChannel = "email" | "sms" | "both" | "none";

/** Which channels a preference actually resolves to, given what they gave us. */
export function channelsFor(
  preference: NotifyChannel,
  contact: { email: string | null; phone: string | null; hasDevice?: boolean },
): Channel[] {
  if (preference === "none") return [];
  const out: Channel[] = [];
  if ((preference === "email" || preference === "both") && contact.email) {
    out.push("email");
  }
  if ((preference === "sms" || preference === "both") && toE164(contact.phone)) {
    out.push("sms");
  }
  // Push is not one of the four preference values, and deliberately so.
  // `notify_channel` is about how we reach you *away* from the app — an
  // address we have to be given. A registered device is different: you
  // installed the watch app and granted it permission, which is the consent.
  // So push rides along with any preference except "none", which stays a
  // global mute rather than an email/SMS setting.
  if (contact.hasDevice) out.push("push");
  return out;
}

/* ---------------------------------- html ---------------------------------- */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The plain-text body, rendered.
 *
 * Deliberately table-free and inline-styled: every school mail client mangles
 * something, and the text version is the one that always arrives intact —
 * so the HTML says exactly the same words rather than a different design.
 */
export function renderEmailHtml({
  text,
  url,
  cta,
}: {
  text: string;
  url: string;
  cta: string;
}): string {
  const paragraphs = text
    .split("\n\n")
    .map((block) => escapeHtml(block).replace(/\n/g, "<br>"))
    // The link is rendered as a button below, so drop the bare URL line.
    .filter((block) => !block.includes(escapeHtml(url)))
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#3A3C41">${block}</p>`,
    )
    .join("");

  return `<!doctype html><html><body style="margin:0;padding:24px;background:#F1EFE8;font-family:'Helvetica Neue',Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:20px;padding:28px">
${paragraphs}
<a href="${escapeHtml(url)}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 24px;border-radius:999px;background:#17171A;color:#FFFFFF;font-weight:600;font-size:16px;text-decoration:none">${escapeHtml(cta)}</a>
</div>
</body></html>`;
}
