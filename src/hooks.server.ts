import type { Handle } from '@sveltejs/kit/hooks';
import { analyticsHead } from '#lib/orbital-preflight/analytics/snippet.ts';
import { base, site } from '#lib/orbital-preflight/site.ts';

/**
 * Writes the config's analytics tags into the `<head>` through the `%op.analytics%`
 * placeholder in `src/app.html`. The site is prerendered, so this runs once at build time
 * and never on a server: the tags are part of the static file Pages serves, which is
 * what Google's installation check looks for.
 */
const head = analyticsHead(site.analytics, base);

export const handle: Handle = ({ event, resolve }) =>
	resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%op.analytics%', head)
	});
