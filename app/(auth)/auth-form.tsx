"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "./actions";
import { Button, Field, FormError, Input, Select } from "@/components/ui";

const initial: AuthState = { error: null, notice: null };

export function AuthForm({
  mode,
  initialError,
}: {
  mode: "login" | "signup";
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState(
    mode === "login" ? signIn : signUp,
    initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-ink-body">
          {mode === "login"
            ? "Sign in to see your league."
            : "Name, email, grade — that's all we collect."}
        </p>
      </div>

      <FormError message={state.error ?? initialError} />
      {state.notice ? (
        <p className="rounded-control bg-ink px-4 py-3 text-sm font-medium text-white">
          {state.notice}
        </p>
      ) : null}

      {mode === "signup" ? (
        <>
          <Field label="Full name" htmlFor="full_name">
            <Input
              id="full_name"
              name="full_name"
              autoComplete="name"
              placeholder="Jordan Cohen"
              required
            />
          </Field>
          <Field label="Grade" htmlFor="grade">
            <Select id="grade" name="grade" defaultValue="">
              <option value="">Prefer not to say</option>
              <option value="9">9th</option>
              <option value="10">10th</option>
              <option value="11">11th</option>
              <option value="12">12th</option>
            </Select>
          </Field>
        </>
      ) : null}

      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@school.org"
          required
        />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint={mode === "signup" ? "At least 8 characters." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? "One sec…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </Button>

      <p className="text-center text-sm text-ink-body">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-ink underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-ink underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
