import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function IconGrid(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2.2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2.2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2.2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2.2" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M15.5 5.4a3.2 3.2 0 1 1 1.6 6.1" />
      <path d="M17.5 14.6c1.7.5 2.8 1.9 3.2 4" />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.8 3.6-5.8 7-5.8s6.2 2 7 5.8" />
    </svg>
  );
}

export function IconTrophy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H4.5v1.5A3.5 3.5 0 0 0 8 10" />
      <path d="M16 5h3.5v1.5A3.5 3.5 0 0 1 16 10" />
      <path d="M12 14v3.5" />
      <path d="M8.5 20.5h7" />
      <path d="M12 17.5c-1.8 0-2.7 1-3 3" />
      <path d="M12 17.5c1.8 0 2.7 1 3 3" />
    </svg>
  );
}

export function IconChart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8.5 16v-5" />
      <path d="M13 16V8" />
      <path d="M17.5 16v-8.5" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5.5" width="16" height="15" rx="3" />
      <path d="M4 10.5h16" />
      <path d="M8.5 3.5v4" />
      <path d="M15.5 3.5v4" />
      <path d="M8.5 14.5h2.5" />
      <path d="M13.5 14.5H16" />
    </svg>
  );
}

export function IconWhistle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13.5 8.5H21v3.4l-5 1.2a5.3 5.3 0 1 1-2.5-4.6Z" />
      <circle cx="10.8" cy="13.8" r="1" fill="currentColor" stroke="none" />
      <path d="M8 5.5v-2" />
      <path d="M11.5 5.8 12.3 4" />
      <path d="M4.9 6.7 3.6 5.2" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 10a6 6 0 0 1 12 0c0 3.5.8 5 1.8 6H4.2C5.2 15 6 13.5 6 10Z" />
      <path d="M9.8 19.5a2.4 2.4 0 0 0 4.4 0" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12h15" />
      <path d="m13.5 6 6 6-6 6" />
    </svg>
  );
}

export function IconLogout(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h7" />
      <path d="M10 12h9.5" />
      <path d="m16 8.5 3.5 3.5-3.5 3.5" />
    </svg>
  );
}

export function IconTicket(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v1a2.5 2.5 0 0 0 0 5v1a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5v-1a2.5 2.5 0 0 0 0-5v-1Z" />
      <path d="M14 6v12" strokeDasharray="2.5 2.5" />
    </svg>
  );
}

export function IconCopy(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5" />
    </svg>
  );
}

export function IconBall(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v17" />
      <path d="M3.5 12h17" />
      <path d="M6.2 5.8c2.2 2.4 2.2 10 0 12.4" />
      <path d="M17.8 5.8c-2.2 2.4-2.2 10 0 12.4" />
    </svg>
  );
}

/** Draft queue marker — replaces the star glyph (no emoji/dingbats). */
export function IconQueue(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6.5h11" />
      <path d="M4 12h11" />
      <path d="M4 17.5h7" />
      <path d="M17.5 15v6" />
      <path d="M20.5 18h-6" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h1.7a2 2 0 0 0 1.7-1l.5-.9a1.5 1.5 0 0 1 1.3-.7h2.6a1.5 1.5 0 0 1 1.3.7l.5.9a2 2 0 0 0 1.7 1h1.7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

export function IconPalette(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.9-.8 1.9-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.6 1.7-1.6h1.3a4.6 4.6 0 0 0 4.6-4.6C20.5 6.6 16.7 3.5 12 3.5Z" />
      <circle cx="7.8" cy="11.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.2" cy="7.9" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ------------------------------------------------------ navigation icons --
   One glyph per destination, so the rail reads by shape before it reads by
   word. Same 24-grid, same 1.8 stroke as the set above. */

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.8 10.4 12 4l8.2 6.4" />
      <path d="M5.9 9.2V19a1.6 1.6 0 0 0 1.6 1.6h9a1.6 1.6 0 0 0 1.6-1.6V9.2" />
      <path d="M9.9 20.6v-5.3h4.2v5.3" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.3V12l3.2 1.9" />
    </svg>
  );
}

/** Standings — ranked rows, each with its position tick. */
export function IconList(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 6.6h2.4" />
      <path d="M4 12h2.4" />
      <path d="M4 17.4h2.4" />
      <path d="M9.8 6.6H20" />
      <path d="M9.8 12H20" />
      <path d="M9.8 17.4H20" />
    </svg>
  );
}

/** Trades — two players going the other way. */
export function IconSwap(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9h13" />
      <path d="M13.6 5.6 17 9l-3.4 3.4" />
      <path d="M20 15H7" />
      <path d="M10.4 11.6 7 15l3.4 3.4" />
    </svg>
  );
}

export function IconBook(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 4.8h11.2a2 2 0 0 1 2 2v12.4H7a2 2 0 0 1-2-2Z" />
      <path d="M5 17.2a2 2 0 0 1 2-2h11.2" />
      <path d="M8.6 8.6h6.2" />
    </svg>
  );
}

/** Console — the settings desk. */
export function IconSliders(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.2h9.4" />
      <path d="M18.2 8.2H20" />
      <circle cx="15.8" cy="8.2" r="2.2" />
      <path d="M4 15.8h3.8" />
      <path d="M12.6 15.8H20" />
      <circle cx="10.2" cy="15.8" r="2.2" />
    </svg>
  );
}

export function IconFilm(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.2" y="5" width="17.6" height="14" rx="3" />
      <path d="M7.8 5v14" />
      <path d="M16.2 5v14" />
      <path d="M3.2 12h17.6" />
    </svg>
  );
}

/** Members — the roll, not the roster. */
export function IconIdCard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="8.8" cy="11" r="2.1" />
      <path d="M5.7 16.1a3.4 3.4 0 0 1 6.2 0" />
      <path d="M14.8 10.2h3.6" />
      <path d="M14.8 13.6h3.6" />
    </svg>
  );
}

/**
 * The Apple mark, for the App Store link.
 *
 * The only solid icon in this file — every other one is a 1.8px stroke, but
 * the Apple logo is a filled silhouette and a stroked outline of it reads as
 * a drawing of the logo rather than the logo. So it opts out of `base()`.
 */
export function IconApple({ size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      {...props}
    >
      <path d="M16.365 1.43c0 1.14-.468 2.243-1.187 3.043-.869.966-2.29 1.716-3.43 1.626a3.6 3.6 0 0 1-.028-.406c0-1.096.51-2.264 1.279-3.03.79-.79 2.13-1.386 3.24-1.433.075.066.126.152.126.2ZM20.7 17.13c-.5 1.16-.74 1.68-1.38 2.7-.9 1.43-2.17 3.2-3.74 3.22-1.4.01-1.76-.9-3.66-.89-1.9.01-2.29.91-3.69.9-1.57-.01-2.77-1.61-3.67-3.03-2.52-3.99-2.78-8.67-1.23-11.16 1.1-1.77 2.84-2.8 4.47-2.8 1.66 0 2.7.91 4.08.91 1.33 0 2.14-.91 4.06-.91 1.45 0 2.99.79 4.08 2.15-3.59 1.97-3.01 7.1.68 8.91Z" />
    </svg>
  );
}
