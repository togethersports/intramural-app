/**
 * Swiping between tabs.
 *
 * The bottom tabs navigator has no gesture of its own — every tab change was
 * a tap on the bar, which is not how anyone holds a phone one-handed. This
 * is a pan on the whole tab area that steps to the neighbouring tab.
 *
 * The offsets are the whole trick. `activeOffsetX` means the gesture only
 * claims a drag once it has travelled sideways, and `failOffsetY` makes it
 * give up the moment a drag looks vertical — so the lists inside every tab
 * still scroll normally, and only a deliberate sideways move switches tabs.
 * A fast flick counts even when it is short, which is what a thumb does.
 */
import { Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

/** Left to right, matching the bar. */
export const TAB_ROUTES = [
  "/",
  "/schedule",
  "/standings",
  "/inbox",
  "/profile",
] as const;

const DISTANCE = 60;
const FLICK = 500;

export function tabSwipeGesture(
  currentIndex: number,
  go: (path: string) => void,
) {
  const step = (direction: 1 | -1) => {
    const next = currentIndex + direction;
    if (next < 0 || next >= TAB_ROUTES.length) return;
    go(TAB_ROUTES[next]);
  };

  return Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      "worklet";
      const far = Math.abs(e.translationX) > DISTANCE;
      const fast = Math.abs(e.velocityX) > FLICK;
      if (!far && !fast) return;
      // Drag left → the tab to the right, the way pages move under a thumb.
      runOnJS(step)(e.translationX < 0 ? 1 : -1);
    });
}
