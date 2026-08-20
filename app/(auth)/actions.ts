"use server";

import { AuthApiError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type AuthState = {
  error: string | null;
  notice?: string | null;
};

const NOT_CONFIGURED =
  "The backend isn't connected yet. Add your Supabase keys — see the Setup page.";

const UNREACHABLE =
  "Couldn't reach the sign-in service. Check your connection and try again.";

/**
 * Supabase's own text for these codes is accurate but doesn't say what to
 * do about it ("Email rate limit exceeded"), which breaks the "errors name
 * the fix" rule. Swap in a message that does, keyed on the stable error
 * code rather than the message text.
 */
const FRIENDLY_CODES: Record<string, string> = {
  over_email_send_rate_limit:
    "Too many sign-up emails were sent in the last hour. Wait a bit and try again — or if this keeps happening, the commissioner needs to add a real email provider in Supabase (Authentication → Settings → SMTP). The default sender is capped at a couple of emails an hour.",
  over_sms_send_rate_limit:
    "Too many verification texts were sent recently. Wait a few minutes and try again.",
  over_request_rate_limit:
    "Too many attempts in a short time. Wait a minute and try again.",
};

/**
 * `AuthApiError` means Supabase itself answered with a real, user-facing
 * message ("Invalid login credentials", "User already registered"). Anything
 * else — a dropped connection, a proxy/CDN error page the client tried to
 * parse as JSON — is a transport failure, and showing its raw text would
 * break the "errors name the fix" rule. Show a generic, actionable message
 * instead.
 */
function authErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    return FRIENDLY_CODES[error.code ?? ""] ?? error.message;
  }
  return UNREACHABLE;
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password)
    return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error) };
  redirect("/dashboard");
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const grade = String(formData.get("grade") ?? "").trim();

  if (!fullName) return { error: "Your name is required." };
  if (!email || !password)
    return { error: "Email and password are required." };
  if (password.length < 8)
    return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, grade: grade || null },
    },
  });
  if (error) return { error: authErrorMessage(error) };
  if (data.session) redirect("/dashboard");
  return {
    error: null,
    notice: "Check your email for a confirmation link, then sign in.",
  };
}

/**
 * Hand off to Google.
 *
 * Supabase mints the consent URL and we redirect the browser to it; Google
 * sends the person back to /auth/callback, which already knows how to
 * exchange the PKCE `code` for a session — the same route the email
 * confirmation links use.
 *
 * Account linking is Supabase's, not ours: when the Google account's email
 * is verified and matches an existing user, it attaches as an identity on
 * that user rather than creating a second one. That behaviour is on by
 * default; turning off "Confirm email" in the dashboard would break it,
 * because an unverified match is exactly the account-takeover case linking
 * must refuse.
 */
export async function signInWithGoogle(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const next = String(formData.get("next") ?? "/dashboard");
  // The redirect has to be absolute and has to match an entry in Supabase's
  // allow-list, so derive it from the request rather than from an env var
  // that would be wrong on every preview deploy.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (!host) return { error: UNREACHABLE };
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // Ask for a refresh token so a long-lived session survives without
      // bouncing the person back through consent.
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });

  if (error) {
    if (error instanceof AuthApiError && error.message.includes("provider is not enabled")) {
      return {
        error:
          "Google sign-in isn't switched on for this league yet. The commissioner enables it in Supabase under Authentication → Providers → Google.",
      };
    }
    return { error: authErrorMessage(error) };
  }
  if (!data.url) return { error: UNREACHABLE };
  redirect(data.url);
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
