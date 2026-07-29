import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

/*
  Same project, same RLS. The anon key is designed to be public — row-level
  security is what actually protects the data, exactly as on the web.
*/
const url =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ??
  "";
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined) ??
  "";

export const isSupabaseConfigured = () => Boolean(url && anonKey);

export const supabase = createClient(url || "http://localhost", anonKey || "public-anon-key", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL to parse in a native app; leaving this on breaks cold start.
    detectSessionInUrl: false,
  },
});
