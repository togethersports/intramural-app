"use client";

import { useState } from "react";
import { IconCopy } from "@/components/icons";

export function CopyButton({
  text,
  label,
  getText,
}: {
  text?: string;
  label: string;
  /** Compute the text at click time (e.g. include window.location.origin). */
  getText?: "invite-link";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const value =
      getText === "invite-link" && text
        ? `${window.location.origin}/join?code=${text}`
        : (text ?? "");
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable (e.g. non-secure context) — no-op
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-11 items-center gap-2 rounded-control bg-surface-dim px-4 text-sm font-medium text-ink transition-colors hover:bg-[#e0e1da]"
    >
      <IconCopy size={16} />
      {copied ? "Copied!" : label}
    </button>
  );
}
