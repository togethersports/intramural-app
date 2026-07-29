import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Lockup } from "./mark";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export { Mark, Lockup } from "./mark";

/** Wordmark lockup, kept for call sites that predate the brand refresh. */
export function Logo({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return <Lockup size={38} tone={dark ? "white-red" : "ink"} className={className} />;
}

/* --------------------------------- Button ---------------------------------
   999px radius, 14/24 padding. One red button per view — `accent` is the
   league-defining action on a screen, everything else is ink or quiet.
   On Court Blue, secondary buttons are 22% white fill with white text. */

type ButtonVariant = "accent" | "primary" | "light" | "quiet" | "canvas";

const buttonStyles: Record<ButtonVariant, string> = {
  accent: "bg-accent text-white hover:bg-[#AC1F26] active:scale-[0.98]",
  primary: "bg-ink text-white hover:bg-black active:scale-[0.98]",
  light: "bg-paper text-ink hover:bg-surface active:scale-[0.98]",
  quiet: "bg-paper text-ink font-medium hover:bg-surface active:scale-[0.98]",
  canvas:
    "bg-white/22 text-white backdrop-blur-sm hover:bg-white/32 active:scale-[0.98]",
};

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[17px] font-semibold leading-none transition-colors outline-offset-2 disabled:pointer-events-none disabled:opacity-40";

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cx(buttonBase, buttonStyles[variant], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link
      className={cx(buttonBase, buttonStyles[variant], className)}
      {...props}
    />
  );
}

/* ---------------------------------- Forms --------------------------------- */

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="label block">
        {label}
      </label>
      {children}
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
    </div>
  );
}

const inputBase =
  "w-full min-h-11 rounded-control border border-rule bg-paper px-4 text-[17px] text-ink placeholder:text-ink-faint focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputBase, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select className={cx(inputBase, "appearance-none", className)} {...props} />
  );
}

/** Errors name the fix (brandbook 07) — pass a sentence that says what to do. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-row bg-tint px-4 py-3 text-[17px] font-medium text-accent"
    >
      {message}
    </p>
  );
}

/** Confirmation / neutral notice. No green in the palette — ink does it. */
export function FormNotice({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="rounded-row bg-ink px-4 py-3 text-[17px] font-medium text-white">
      {message}
    </p>
  );
}

/* ---------------------------------- Badge ---------------------------------- */

const roleTone: Record<string, string> = {
  commissioner: "bg-ink text-white",
  admin: "bg-bench text-white",
  captain: "bg-accent text-white",
  player: "bg-rule text-ink-body",
  spectator: "bg-rule text-ink-muted",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cx(
        "label inline-flex items-center rounded-full px-2.5 py-1 !text-[11px]",
        roleTone[role] ?? roleTone.player,
        role === "player" || role === "spectator" ? "" : "!text-white",
      )}
    >
      {role}
    </span>
  );
}

/* --------------------------------- Avatar ----------------------------------
   Initials on Night Court. Never tinted by team colour — team colour lives in
   team badges and bracket rows only (brandbook 04). */

export function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-full bg-ink font-medium text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials || "—"}
    </span>
  );
}

/** Team identity chip — one of the two places team colour is allowed. */
export function TeamBadge({
  abbrev,
  color,
  size = 28,
}: {
  abbrev: string;
  color: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[8px] font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.36,
      }}
    >
      {abbrev.slice(0, 3).toUpperCase()}
    </span>
  );
}

/* -------------------------------- Stat tile -------------------------------- */

export function StatTile({
  label,
  value,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("card flex flex-col gap-1 p-6", className)}>
      <span className="label">{label}</span>
      <div className="num text-[40px] leading-none tracking-tight text-ink">
        {value}
      </div>
      {children}
    </div>
  );
}

/* -------------------------------- Meter bar -------------------------------- */

export function Meter({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cx("h-2 w-full overflow-hidden rounded-full bg-tint", className)}
    >
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* -------------------------------- Empty state ------------------------------- */

export function EmptyState({
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel bg-paper px-6 py-8">
      <div>
        <p className="text-[19px] font-semibold">{title}</p>
        {body ? (
          <p className="mt-1 max-w-[62ch] text-[17px] leading-relaxed text-ink-body">
            {body}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------- Page header -------------------------------
   On Court Blue: white at 500 or heavier, never Night Court body copy. */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.025em] text-white">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[17px] font-medium text-white">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
