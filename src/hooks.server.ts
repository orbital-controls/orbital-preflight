import type { Handle } from '@sveltejs/kit/hooks';
import { analyticsSettings } from '#lib/orbital-preflight/analytics/settings.ts';
import { analyticsHead } from '#lib/orbital-preflight/analytics/snippet.ts';
import { base } from '#lib/orbital-preflight/site.ts';

/**
 * Writes the analytics tags into the `<head>` through the `%op.analytics%` placeholder in
 * `src/app.html`. The site is prerendered, so this runs once at build time and never on a
 * server: the tags are part of the static file Pages serves, which is what Google's
 * installation check looks for.
 *
 * The IDs come from the build's environment (`GA_MEASUREMENT_ID`, `UMAMI_WEBSITE_ID`,
 * `UMAMI_HOST`), which the Pages workflow fills from repository variables. See
 * `analytics/settings.ts`.
 */
const head = analyticsHead(analyticsSettings(process.env), base);

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%op.analytics%', head)
	});
