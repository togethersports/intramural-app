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
