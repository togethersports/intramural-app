import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Lets the in-app browser hand the session back the moment Google redirects
// instead of leaving the sheet open.
WebBrowser.maybeCompleteAuthSession();

/**
 * Pull the tokens out of whatever Supabase redirected back with.
 *
 * The PKCE flow returns `?code=`; the implicit flow returns the tokens in
 * the URL *fragment*. A native redirect can arrive in either shape depending
 * on the project's flow setting, so handle both rather than betting on one.
 */
function parseAuthRedirect(url: string): {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
} {
  const [beforeHash, hash = ""] = url.split("#");
  const query = beforeHash.includes("?") ? beforeHash.split("?")[1] : "";
  const params = new URLSearchParams(query);
  const fragment = new URLSearchParams(hash);
  const error =
    params.get("error_description") ??
    params.get("error") ??
    fragment.get("error_description") ??
    fragment.get("error") ??
    undefined;
  return {
    code: params.get("code") ?? undefined,
    accessToken: fragment.get("access_token") ?? undefined,
    refreshToken: fragment.get("refresh_token") ?? undefined,
    error,
  };
}

interface AuthValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Returns an error string, or null on success *or* on a cancelled sheet. */
  signInWithGoogle: () => Promise<string | null>;
  signUp: (
    fullName: string,
    email: string,
    password: string,
    grade?: string,
  ) => Promise<{ error: string | null; notice: string | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Supabase's own message for a few codes is accurate but doesn't say what to
 * do about it. Keyed on the stable code, not the message text — same table
 * as the web app's app/(auth)/actions.ts.
 */
const FRIENDLY: Record<string, string> = {
  over_email_send_rate_limit:
    "Too many sign-up emails in the last hour. Wait a bit and try again.",
  over_request_rate_limit: "Too many attempts. Wait a minute and try again.",
  invalid_credentials: "That email and password don't match. Try again.",
  email_not_confirmed:
    "Confirm your email first — check your inbox for the link.",
  user_already_exists: "That email already has an account. Sign in instead.",
};

function message(error: { code?: string; message: string } | null): string | null {
  if (!error) return null;
  return FRIENDLY[error.code ?? ""] ?? error.message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Supabase only auto-refreshes while the app is foregrounded; without this
  // a session can expire while backgrounded and the next request 401s.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        return message(error);
      },
      /**
       * Opens Google in an ASWebAuthenticationSession, which is what Apple
       * requires for third-party sign-in: it shares Safari's cookie jar, so
       * a student already signed into their school account gets one tap.
       */
      async signInWithGoogle() {
        // The app's own scheme — registered as "intramural" in app.json and
        // allow-listed in Supabase under Authentication → URL Configuration.
        const redirectTo = Linking.createURL("auth-callback");
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            // We drive the browser ourselves; letting the SDK navigate does
            // nothing useful in a native app.
            skipBrowserRedirect: true,
            queryParams: { access_type: "offline", prompt: "consent" },
          },
        });
        if (error) return message(error);
        if (!data.url) return "Couldn't reach Google. Check your connection.";

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        // Dismissing the sheet is a decision, not a failure — say nothing.
        if (result.type !== "success") return null;

        const parsed = parseAuthRedirect(result.url);
        if (parsed.error) return parsed.error;

        if (parsed.code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(parsed.code);
          return message(exchangeError);
        }
        if (parsed.accessToken && parsed.refreshToken) {
          const { error: setError } = await supabase.auth.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          return message(setError);
        }
        return "Google sent us back without a session. Try again.";
      },
      async signUp(fullName, email, password, grade) {
        if (!fullName.trim()) return { error: "Your name is required.", notice: null };
        if (password.length < 8)
          return { error: "Password must be at least 8 characters.", notice: null };
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim(), grade: grade || null } },
        });
        if (error) return { error: message(error), notice: null };
        if (data.session) return { error: null, notice: null };
        return {
          error: null,
          notice: "Check your email for a confirmation link, then sign in.",
        };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
      async deleteAccount() {
        const { error } = await supabase.rpc("delete_my_account");
        if (error) return error.message;
        await supabase.auth.signOut();
        return null;
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
