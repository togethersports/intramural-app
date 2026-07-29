"use client";

import { useActionState } from "react";
import { createLeague, type ActionState } from "../../actions";
import { Button, Field, FormError, Input, Select } from "@/components/ui";
import { LEAGUE_COLORS, SPORTS } from "@/packages/core/league-constants";

const initial: ActionState = { error: null };

export function NewLeagueForm() {
  const [state, formAction, pending] = useActionState(createLeague, initial);

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <Field label="League name" htmlFor="name">
        <Input
          id="name"
          name="name"
          placeholder="Ramaz Winter Hoops"
          minLength={3}
          required
        />
      </Field>

      <Field
        label="School or organization"
        htmlFor="org_name"
        hint="Optional — groups leagues from the same school."
      >
        <Input id="org_name" name="org_name" placeholder="Ramaz Upper School" />
      </Field>

      <Field label="Sport" htmlFor="sport">
        <Select id="sport" name="sport" defaultValue="basketball">
          {SPORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-medium text-ink-body">
          League color
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {LEAGUE_COLORS.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={c}
                defaultChecked={i === 0}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="block size-11 rounded-full border-4 border-transparent transition-all peer-checked:border-ink/80 peer-focus-visible:ring-2 peer-focus-visible:ring-ink"
                style={{ backgroundColor: c }}
              />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create league"}
      </Button>
      <p className="text-center text-xs text-ink-faint">
        You&apos;ll be the commissioner. A join code is generated for you to
        share.
      </p>
    </form>
  );
}
