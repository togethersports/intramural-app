"use client";

import { useState } from "react";
import { setAvailability } from "../actions";
import type { TimeSlotRow } from "@core/types";
import { slotRange } from "@core/time";
import { FormError } from "@/components/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const OPTIONS = [
  { value: "yes", label: "In", active: "bg-ink text-on-ink" },
  { value: "maybe", label: "Maybe", active: "bg-bench text-white" },
  { value: "no", label: "Out", active: "bg-accent text-on-accent" },
] as const;

type Status = "yes" | "maybe" | "no";

export function AvailabilityGrid({
  seasonId,
  slots,
  initial,
}: {
  seasonId: string;
  slots: TimeSlotRow[];
  initial: Record<string, Status>;
}) {
  // Plain state, not useOptimistic. An optimistic value only lasts while its
  // save is in flight, then falls back to `initial` — and `initial` is the
  // page as first loaded, which saving doesn't reload. So every pick blinked
  // off once it saved, and only the one or two still saving stayed lit:
  // "it won't let me pick more than two". Like the phone app, this keeps
  // what you tapped and rolls back only the one that didn't save.
  const [picked, setPicked] = useState<Record<string, Status>>(initial);
  const [error, setError] = useState<string | null>(null);

  const set = async (slotId: string, status: Status) => {
    const before = picked[slotId];
    setPicked((p) => ({ ...p, [slotId]: status }));
    setError(null);
    const res = await setAvailability(seasonId, slotId, status).catch(() => ({
      error: "network",
    }));
    if (res.error) {
      setPicked((p) => {
        const next = { ...p };
        if (before) next[slotId] = before;
        else delete next[slotId];
        return next;
      });
      setError("That one didn't save. Check your connection and tap it again.");
    }
  };

  return (
    <div className="space-y-3">
      <FormError message={error} />
      <ul className="space-y-2.5">
        {slots.map((slot) => {
          const current = picked[slot.id];
          return (
            <li
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-paper p-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{slot.label}</p>
                <p className="text-sm text-ink-body">
                  {DAYS[slot.day_of_week]} · {slotRange(slot.start_time, slot.end_time)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label={slot.label}>
                {OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={current === opt.value}
                    onClick={() => set(slot.id, opt.value)}
                    className={`min-h-11 min-w-[4.25rem] rounded-control px-3 text-sm font-semibold transition-colors ${
                      current === opt.value
                        ? opt.active
                        : "bg-surface text-ink-body hover:bg-paper"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
