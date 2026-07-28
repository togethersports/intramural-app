import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
