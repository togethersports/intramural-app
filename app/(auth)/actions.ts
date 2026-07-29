"use server";

import { AuthApiError } from "@supabase/supabase-js";
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

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
