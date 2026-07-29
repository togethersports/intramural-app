"use client";

import { useOptimistic, useTransition } from "react";
import { setAvailability } from "../actions";
import type { TimeSlotRow } from "@core/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const OPTIONS = [
  { value: "yes", label: "In", active: "bg-ink text-white" },
  { value: "maybe", label: "Maybe", active: "bg-bench text-white" },
  { value: "no", label: "Out", active: "bg-accent text-white" },
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
  const [optimistic, applyOptimistic] = useOptimistic(
    initial,
    (state, update: { slotId: string; status: Status }) => ({
      ...state,
      [update.slotId]: update.status,
    }),
  );
  const [, startTransition] = useTransition();

  const set = (slotId: string, status: Status) => {
    startTransition(async () => {
      applyOptimistic({ slotId, status });
      await setAvailability(seasonId, slotId, status);
    });
  };

  return (
    <ul className="space-y-2.5">
      {slots.map((slot) => {
        const current = optimistic[slot.id];
        return (
          <li
            key={slot.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-paper p-3.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{slot.label}</p>
              <p className="text-sm text-ink-body">
                {DAYS[slot.day_of_week]} · {slot.start_time.slice(0, 5)}–
                {slot.end_time.slice(0, 5)}
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
  );
}
