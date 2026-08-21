"use client";

import { useActionState, useRef, useState } from "react";
import { AppearancePicker } from "@/components/appearance-picker";
import { IconCamera } from "@/components/icons";
import {
  Avatar,
  Button,
  Field,
  FormError,
  FormNotice,
  Input,
  Select,
} from "@/components/ui";
import { positionsFor } from "@core/league-constants";
import type { ThemePreset } from "@core/theme";
import {
  updateMyAppearance,
  updateNotifyPrefs,
  updateProfile,
  updateProfilePhoto,
  type ActionState,
} from "./actions";

const EMPTY: ActionState = { error: null };

export function PhotoForm({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateProfilePhoto, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} src={preview ?? avatarUrl} size={88} />
        <div className="space-y-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-on-ink transition-opacity hover:opacity-90">
            <IconCamera size={17} />
            {avatarUrl ? "Change photo" : "Add a photo"}
            <input
              type="file"
              name="photo"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Show it straight away — the upload round trip is long
                // enough that a still-blank circle reads as a failure.
                if (file) setPreview(URL.createObjectURL(file));
                formRef.current?.requestSubmit();
              }}
            />
          </label>
          <p className="text-[13px] text-ink-body">
            JPG, PNG, WebP or GIF, up to 4 MB.
          </p>
        </div>
        {avatarUrl ? (
          <Button
            type="submit"
            name="intent"
            value="remove"
            variant="quiet"
            className="!min-h-11 !px-4 !text-[15px]"
            onClick={() => setPreview(null)}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {pending ? (
        <p className="text-[15px] text-ink-body">Uploading…</p>
      ) : (
        <>
          <FormError message={state.error} />
          <FormNotice message={state.notice} />
        </>
      )}
    </form>
  );
}

export function DetailsForm({
  sport,
  profile,
}: {
  sport: string;
  profile: {
    full_name: string;
    grade: number | null;
    height_in: number | null;
    jersey_pref: number | null;
    positions: string[];
  };
}) {
  const [state, action, pending] = useActionState(updateProfile, EMPTY);
  const options = positionsFor(sport);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="sport" value={sport} />
      <FormError message={state.error} />
      <FormNotice message={state.notice} />

      <Field label="Name" htmlFor="full_name">
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile.full_name}
          maxLength={80}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Grade" htmlFor="grade">
          <Select id="grade" name="grade" defaultValue={profile.grade ?? ""}>
            <option value="">—</option>
            {Array.from({ length: 13 }, (_, i) => i + 1).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Height" htmlFor="height_in" hint="In inches.">
          <Input
            id="height_in"
            name="height_in"
            type="number"
            min={36}
            max={96}
            defaultValue={profile.height_in ?? ""}
            className="num"
          />
        </Field>
        <Field label="Jersey" htmlFor="jersey_pref" hint="Your preferred number.">
          <Input
            id="jersey_pref"
            name="jersey_pref"
            type="number"
            min={0}
            max={99}
            defaultValue={profile.jersey_pref ?? ""}
            className="num"
          />
        </Field>
      </div>

      <div>
        <p className="label mb-2 !text-[11px]">Positions</p>
        <div className="flex flex-wrap gap-2">
          {options.map((p) => (
            <label
              key={p.value}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-rule bg-paper px-4 text-[15px] font-medium has-checked:border-accent has-checked:bg-tint has-checked:text-accent-ink"
            >
              <input
                type="checkbox"
                name="positions"
                value={p.value}
                defaultChecked={profile.positions.includes(p.value)}
                className="size-4 accent-[var(--color-accent)]"
              />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-ink-body">
          Captains sort lineups by these. Pick every one you actually play.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function MyAppearanceForm({
  preset,
  accent,
  overriding,
}: {
  preset: ThemePreset;
  accent: string;
  overriding: boolean;
}) {
  const [state, action, pending] = useActionState(updateMyAppearance, EMPTY);

  return (
    <form action={action} className="space-y-5">
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
      <p className="text-[15px] text-ink-body">
        {overriding
          ? "You are using your own colours. Your leagues' own palettes are being ignored."
          : "You are matching whatever palette each league sets. Change anything below to override that."}
      </p>
      <AppearancePicker defaultPreset={preset} defaultAccent={accent} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Use these colours"}
        </Button>
        {overriding ? (
          <Button type="submit" name="intent" value="clear" variant="quiet">
            Match my league instead
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * When and how the app is allowed to interrupt you.
 *
 * The three sends are fixed by the league (the morning of, an hour out, ten
 * minutes out); the only choice here is which pipe they come down. "None"
 * is a real option — a player who checks the app anyway shouldn't have to
 * mute a phone number to stop the texts.
 */
export function NotifyForm({
  channel,
  phone,
  email,
}: {
  channel: "email" | "sms" | "both" | "none";
  phone: string;
  email: string | null;
}) {
  const [state, action, pending] = useActionState(updateNotifyPrefs, EMPTY);
  const [chosen, setChosen] = useState(channel);
  const wantsSms = chosen === "sms" || chosen === "both";

  return (
    <form action={action} className="space-y-5">
      <FormError message={state.error} />
      <FormNotice message={state.notice} />

      <p className="text-[15px] text-ink-body">
        Every game you&apos;re rostered for sends three reminders: at 7:15 the
        morning of, an hour before tip-off, and ten minutes before. Flag
        yourself out of a game and they stop for that one.
      </p>

      <div>
        <p className="label mb-2 !text-[11px]">Send them by</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["email", "Email"],
              ["sms", "Text"],
              ["both", "Both"],
              ["none", "Neither"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={
                chosen === value
                  ? "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-accent bg-tint px-5 text-[15px] font-semibold text-accent-ink"
                  : "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-rule bg-paper px-5 text-[15px] font-medium transition-colors hover:border-ink-faint"
              }
            >
              <input
                type="radio"
                name="notify_channel"
                value={value}
                checked={chosen === value}
                onChange={() => setChosen(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {chosen !== "none" && email ? (
        <p className="text-[14px] text-ink-faint">
          Emails go to <span className="font-semibold text-ink-body">{email}</span>.
        </p>
      ) : null}

      <Field
        label="Mobile number"
        htmlFor="phone"
        hint={
          wantsSms
            ? "Ten digits, or start with + and the country code."
            : "Only needed if you switch texts on."
        }
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={phone}
          placeholder="(555) 123-4567"
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save reminder settings"}
      </Button>
    </form>
  );
}
