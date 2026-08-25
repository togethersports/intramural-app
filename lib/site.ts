/*
  Contact details published on /privacy and /support, which Apple links to
  from the App Store listing. This address is public — swap it for a school
  or role address (support@yourschool.org) if you would rather not surface a
  personal inbox.
*/
export const SUPPORT_EMAIL = "harryhonigburger@gmail.com";

/* Apple requires both URLs to be live before an app can be reviewed. */
export const LAST_UPDATED = "29 July 2026";

/**
 * The iOS app's public listing.
 *
 * The number is the App Store Connect app id — the same `ascAppId` that
 * `mobile/eas.json` submits builds against, so the two cannot drift apart.
 * The link only resolves once a build has been approved; until then Apple
 * serves a "not available" page, so pull the button rather than the URL if
 * the listing is still in review.
 */
export const APP_STORE_URL = "https://apps.apple.com/app/id6795986822";

/**
 * Who built it, in the footer.
 *
 * NOTE: this is the link that was handed over, and it is a Google search
 * rather than a LinkedIn profile — the tracking parameters have been
 * stripped, since they described one person's browser session and had no
 * business on a public page. The footer draws a LinkedIn mark next to it,
 * so swap this for the `linkedin.com/in/…` URL when it is to hand and the
 * icon will finally match where it goes.
 */
export const BUILT_BY = "Harry Honig";
export const BUILT_BY_URL = "https://www.google.com/search?q=harry+honig";

/**
 * An absolute URL into the app.
 *
 * Reminders and recaps are read outside the browser — in an inbox, in a text
 * message — so every link they carry has to be absolute. `NEXT_PUBLIC_SITE_URL`
 * is the override for a custom domain; `VERCEL_PROJECT_PRODUCTION_URL` is the
 * stable production hostname (unlike `VERCEL_URL`, which changes per deploy
 * and would bake a dead link into an email).
 */
export function siteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;
  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview}`;
  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  return `${siteOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
