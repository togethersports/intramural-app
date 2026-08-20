"use client";

import { useActionState } from "react";
import { signInWithGoogle, type AuthState } from "@/app/(auth)/actions";
import { FormError } from "@/components/ui";

const initial: AuthState = { error: null };

/**
 * Google's own four-colour "G", at its published proportions. It has to be
 * drawn rather than themed — Google's brand guidelines require the mark to
 * keep its colours on any button that says "Continue with Google".
 */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07Z"
      />
    </svg>
  );
}

/**
 * Above the email/password form, because for a school account it is very
 * often the only credential a student actually remembers.
 */
export function GoogleButton({
  next = "/dashboard",
  label,
}: {
  next?: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(signInWithGoogle, initial);

  return (
    <div className="space-y-3">
      <FormError message={state.error} />
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-rule bg-paper px-6 text-[17px] font-semibold text-ink transition-colors hover:bg-surface disabled:pointer-events-none disabled:opacity-40"
        >
          <GoogleG />
          {pending ? "Opening Google…" : label}
        </button>
      </form>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <span className="label !text-[10px]">or with email</span>
        <span className="h-px flex-1 bg-rule" />
      </div>
    </div>
  );
}
