"use client";

/**
 * A form that asks before it submits. window.confirm is browser-only, so
 * this thin wrapper is a client component — server components render it
 * with a server action and hidden fields, exactly like a plain form.
 * (The dashboard crash taught us the hard way: never put an onSubmit on a
 * form inside a server component.)
 */
export function ConfirmForm({
  action,
  message,
  hidden,
  children,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  hidden: Record<string, string>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {children}
    </form>
  );
}
