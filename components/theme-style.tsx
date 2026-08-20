import { buildPalette, paletteCss, type Appearance } from "@core/theme";

/**
 * Re-declares every colour token for the subtree below it.
 *
 * Tailwind's `@theme` writes the Sideline brand onto `:root` from the
 * stylesheet in `<head>`; this writes the chosen appearance onto `:root`
 * again from inside the body. Same specificity, later in document order, so
 * it wins — including for `body`, which is why the page ground changes and
 * not just the cards.
 *
 * Every value is machine-generated from a hex-validated accent (see
 * `@core/theme`), so nothing user-supplied is interpolated into CSS.
 */
export function ThemeStyle({ appearance }: { appearance: Appearance }) {
  const css = paletteCss(buildPalette(appearance));
  return (
    <style dangerouslySetInnerHTML={{ __html: `:root{${css}}` }} />
  );
}
