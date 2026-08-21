/**
 * Icon key → glyph. lib/nav.ts is pure data with no imports, so it names a
 * destination's icon and this is the one place that turns the name into a
 * component. Adding a destination means adding a key there and a line here.
 */
import {
  IconBell,
  IconBook,
  IconCalendar,
  IconChart,
  IconClock,
  IconFilm,
  IconGrid,
  IconHome,
  IconIdCard,
  IconList,
  IconPlus,
  IconQueue,
  IconSliders,
  IconSwap,
  IconTicket,
  IconTrophy,
  IconUser,
  IconUsers,
} from "@/components/icons";
import type { NavIconName } from "@/lib/nav";

const GLYPHS: Record<NavIconName, (props: { size?: number }) => React.ReactElement> = {
  home: IconHome,
  calendar: IconCalendar,
  clock: IconClock,
  list: IconList,
  chart: IconChart,
  trophy: IconTrophy,
  users: IconUsers,
  queue: IconQueue,
  swap: IconSwap,
  members: IconIdCard,
  book: IconBook,
  console: IconSliders,
  film: IconFilm,
  grid: IconGrid,
  bell: IconBell,
  user: IconUser,
  ticket: IconTicket,
  plus: IconPlus,
};

export function NavIcon({ name, size = 18 }: { name: NavIconName; size?: number }) {
  const Glyph = GLYPHS[name];
  return <Glyph size={size} />;
}
