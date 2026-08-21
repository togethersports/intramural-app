/**
 * The one scroll signal the floating tab bar listens to.
 *
 * Instagram's trick, reduced to its mechanism: the bar reacts to scroll
 * *direction*, not position — down means you're reading, so the chrome gets
 * out of the way; any upward drag means you're about to navigate, so it
 * comes straight back. Direction-based also means a long feed doesn't pin
 * the bar shut the way an offset threshold would.
 *
 * One module-level Animated.Value rather than context: the bar outlives
 * every screen, screens only ever write to it, and a context provider would
 * re-render the whole tab tree on a value that native drives at 60fps.
 */

import { useRef } from "react";
import {
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

/** 0 = full bar (icons + labels), 1 = shrunk (icons only). */
export const barShrink = new Animated.Value(0);

/** Room the floating bar needs at the bottom of every scrolling screen —
    without this, the last card hides behind the pill forever. */
export const TAB_CLEARANCE = 108;

function setShrunk(to: 0 | 1) {
  Animated.spring(barShrink, {
    toValue: to,
    useNativeDriver: false, // height and padding animate — layout properties
    speed: 20,
    bounciness: 4,
  }).start();
}

/**
 * Attach to any ScrollView driving a tab screen:
 *
 *   const onScroll = useBarScroll();
 *   <ScrollView onScroll={onScroll} scrollEventThrottle={16} ...>
 */
export function useBarScroll() {
  const last = useRef(0);
  const shrunk = useRef(false);
  return (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - last.current;
    last.current = y;
    // The dead zone stops rubber-banding at the top from flickering the bar,
    // and the ±4 hysteresis stops a wobbly thumb from toggling it.
    if (y < 32) {
      if (shrunk.current) { shrunk.current = false; setShrunk(0); }
      return;
    }
    if (delta > 4 && !shrunk.current) { shrunk.current = true; setShrunk(1); }
    else if (delta < -4 && shrunk.current) { shrunk.current = false; setShrunk(0); }
  };
}
