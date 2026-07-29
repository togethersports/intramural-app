/*
  The Bracket — Intramural's mark.

  Construction (brandbook 02): drawn on a 64 × 64 unit square. Two seed lines
  enter at y18 and y46, meet a connector, and one line leaves at y32 in
  Whistle Red. Stroke 6 units, round caps, fixed ratio — never re-weighted.
  Clearspace is 28 units (the connector height) on all four sides.

  Below 20px the red output line is dropped (it goes muddy at small sizes),
  which is what `flat` does — the favicon and tiny lockups use it.
*/

type MarkTone = "ink" | "white" | "white-red" | "red";

const STROKE: Record<MarkTone, { line: string; output: string }> = {
  ink: { line: "#17171A", output: "#C9242C" },
  "white-red": { line: "#FFFFFF", output: "#C9242C" },
  white: { line: "#FFFFFF", output: "#FFFFFF" },
  red: { line: "#C9242C", output: "#C9242C" },
};

export function Mark({
  size = 32,
  tone = "ink",
  className,
  title,
}: {
  size?: number;
  tone?: MarkTone;
  className?: string;
  title?: string;
}) {
  const { line, output } = STROKE[tone];
  // Below the 20px minimum the output line matches the rest of the mark.
  const outputStroke = size < 20 ? line : output;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <g stroke={line} strokeWidth={6} strokeLinecap="round" fill="none">
        {/* seeds in */}
        <path d="M10 18h22" />
        <path d="M10 46h22" />
        {/* connector */}
        <path d="M32 18v28" />
      </g>
      {/* the decision, out */}
      <path
        d="M32 32h22"
        stroke={outputStroke}
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Mark + wordmark. Text is 0.53× mark width, gap 0.28× (brandbook 03). */
export function Lockup({
  size = 40,
  tone = "ink",
  className,
}: {
  size?: number;
  tone?: MarkTone;
  className?: string;
}) {
  const onDark = tone === "white" || tone === "white-red";
  return (
    <span
      className={`inline-flex items-center ${className ?? ""}`}
      style={{ gap: size * 0.28 }}
    >
      <Mark size={size} tone={tone} />
      <span
        className="font-semibold"
        style={{
          fontSize: size * 0.53,
          letterSpacing: "-0.02em",
          color: onDark ? "#FFFFFF" : "#17171A",
        }}
      >
        Intramural
      </span>
    </span>
  );
}
