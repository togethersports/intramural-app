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
