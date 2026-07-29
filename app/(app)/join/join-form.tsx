"use client";

import { useActionState } from "react";
import { joinLeague, type ActionState } from "../actions";
import { Button, Field, FormError, Input } from "@/components/ui";

const initial: ActionState = { error: null };

export function JoinForm({ defaultCode }: { defaultCode?: string }) {
  const [state, formAction, pending] = useActionState(joinLeague, initial);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />
      <Field
        label="Join code"
        htmlFor="code"
        hint="Ask your commissioner or captain for the 6-character code."
      >
        <Input
          id="code"
          name="code"
          placeholder="XX7Q2M"
          defaultValue={defaultCode}
          required
          minLength={6}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="text-center font-mono text-2xl uppercase tracking-[0.4em]"
        />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Joining…" : "Join league"}
      </Button>
    </form>
  );
}
