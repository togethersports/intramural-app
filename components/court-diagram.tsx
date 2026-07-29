/*
  The court motif — the one decorative device (brandbook 08).
  Thin white court lines on Court Blue, 2px strokes, true proportions,
  never rotated for effect.
*/
export function CourtDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 560"
      role="img"
      aria-label="Basketball court diagram"
      className={className}
    >
      <rect width="300" height="560" rx="20" fill="var(--color-canvas)" />

      <g stroke="#FFFFFF" strokeWidth="2" fill="none" opacity="0.9">
        {/* Boundary + half court */}
        <rect x="30" y="30" width="240" height="500" rx="2" />
        <line x1="30" y1="280" x2="270" y2="280" />
        <circle cx="150" cy="280" r="38" />
        <circle cx="150" cy="280" r="4" fill="#FFFFFF" stroke="none" />

        {/* Top half */}
        <rect x="102" y="30" width="96" height="115" />
        <circle cx="150" cy="145" r="36" />
        <line x1="132" y1="54" x2="168" y2="54" strokeWidth="3" />
        <circle cx="150" cy="64" r="7" />
        <path d="M45 30 L45 90 A137 137 0 0 0 255 90 L255 30" />

        {/* Bottom half */}
        <rect x="102" y="415" width="96" height="115" />
        <circle cx="150" cy="415" r="36" />
        <line x1="132" y1="506" x2="168" y2="506" strokeWidth="3" />
        <circle cx="150" cy="496" r="7" />
        <path d="M45 530 L45 470 A137 137 0 0 1 255 470 L255 530" />
      </g>

      {/* Dimension ticks */}
      <g stroke="#FFFFFF" strokeWidth="1" opacity="0.5">
        <line x1="30" y1="14" x2="270" y2="14" />
        <line x1="30" y1="10" x2="30" y2="18" />
        <line x1="270" y1="10" x2="270" y2="18" />
        <line x1="286" y1="30" x2="286" y2="280" />
        <line x1="282" y1="30" x2="290" y2="30" />
        <line x1="282" y1="280" x2="290" y2="280" />
      </g>
      <g
        fill="#FFFFFF"
        opacity="0.75"
        fontSize="11"
        fontFamily="var(--font-mono)"
        letterSpacing="0.12em"
      >
        <text x="150" y="11" textAnchor="middle">
          50 FT
        </text>
        <text
          x="297"
          y="155"
          textAnchor="middle"
          transform="rotate(90 297 155)"
        >
          42 FT
        </text>
      </g>
    </svg>
  );
}
