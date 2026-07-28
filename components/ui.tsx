import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { IconBall } from "./icons";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/* ---------------------------------- Logo ---------------------------------- */

export function Logo({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <span className={cx("inline-flex items-center gap-2.5", className)}>
      <span
        className={cx(
          "grid size-9 place-items-center rounded-[12px]",
          dark ? "bg-ink text-surface" : "bg-surface text-ink",
        )}
      >
        <IconBall size={22} />
      </span>
      <span className="text-lg font-semibold tracking-tight">Intramural</span>
    </span>
  );
}

/* --------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "accent" | "soft" | "ghost" | "canvas" | "light";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-surface-bright hover:bg-black active:scale-[0.98] shadow-card",
  accent:
    "bg-accent text-white hover:bg-accent-deep active:scale-[0.98] shadow-card",
  soft: "bg-surface-dim text-ink hover:bg-[#e0e1da] active:scale-[0.98]",
  ghost: "text-ink-soft hover:bg-surface-dim hover:text-ink",
  canvas:
    "border border-white/30 bg-white/15 text-white backdrop-blur-md hover:bg-white/25 active:scale-[0.98]",
  light:
    "bg-surface text-ink hover:bg-surface-bright active:scale-[0.98] shadow-card",
};

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 text-[15px] font-medium transition-all outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

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

/* ---------------------------------- Forms ---------------------------------- */

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
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-medium text-ink-soft"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

const inputBase =
  "w-full min-h-11 rounded-control border border-ink/10 bg-surface-bright px-4 text-[15px] text-ink placeholder:text-ink-faint focus:border-ink/30 focus:outline-none focus:ring-2 focus:ring-ink/10";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputBase, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputBase, "appearance-none", className)} {...props} />;
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-control bg-accent-wash px-4 py-3 text-sm font-medium text-accent-deep"
    >
      {message}
    </p>
  );
}

/* ---------------------------------- Badge ---------------------------------- */

const roleTone: Record<string, string> = {
  commissioner: "bg-ink text-surface",
  admin: "bg-court text-white",
  captain: "bg-accent text-white",
  player: "bg-surface-dim text-ink-soft",
  spectator: "bg-surface-dim text-ink-faint",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        roleTone[role] ?? roleTone.player,
      )}
    >
      {role}
    </span>
  );
}

/* --------------------------------- Avatar ---------------------------------- */

const avatarPalette = ["#54749b", "#c8232c", "#6d8c5e", "#dfa04f", "#3f5a7c"];

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
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const bg = avatarPalette[hash % avatarPalette.length];
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        className,
      )}
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

/* -------------------------------- Stat tile -------------------------------- */

export function StatTile({
  label,
  value,
  icon,
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
    <div className={cx("card flex flex-col gap-1 p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink-soft">{label}</span>
        {icon ? (
          <span className="grid size-8 place-items-center rounded-full bg-surface-dim text-ink-soft">
            {icon}
          </span>
        ) : null}
      </div>
      <div className="stat-num text-4xl text-ink">{value}</div>
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
      className={cx("h-2 w-full overflow-hidden rounded-full bg-accent-wash", className)}
    >
      <div
        className="h-full rounded-full bg-accent"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* -------------------------------- Empty state ------------------------------- */

export function EmptyState({
  icon,
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-panel bg-surface-dim/60 px-6 py-10 text-center">
      {icon ? <div className="text-ink-faint">{icon}</div> : null}
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {body ? <p className="mt-1 text-sm text-ink-soft">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------- Page header -------------------------------- */

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
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 text-white/70">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}
