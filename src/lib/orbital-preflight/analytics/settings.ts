/**
 * Which analytics a build carries, read from the build's environment rather than the
 * config file: the IDs belong to whoever deploys, not to the code a fork copies. The Pages
 * workflow passes them from repository variables of the same names.
 *
 * - `GA_MEASUREMENT_ID`: a GA4 measurement ID (`G-XXXXXXXXXX`).
 * - `UMAMI_WEBSITE_ID`: the UUID the Umami dashboard shows for the site.
 * - `UMAMI_HOST`: where the Umami script is served from. Default `https://cloud.umami.is`.
 *
 * None set, which is what `pnpm dev` and an unconfigured fork are: no analytics at all.
 */

export interface AnalyticsSettings {
	/** The GA4 measurement ID, or null for no Google tag. */
	google: string | null;
	/** The Umami website ID and the origin its script comes from, or null for no Umami. */
	umami: { websiteId: string; host: string } | null;
}

type Env = Record<string, string | undefined>;

// The IDs end up inside a <script> and its attributes, where escaping means nothing, so
// they are checked against their real shapes and a bad one fails the build.
const TAG_ID = /^(G|GT|AW)-[A-Z0-9]+$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGIN = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i;
const UMAMI_CLOUD = 'https://cloud.umami.is';

export function analyticsSettings(env: Env): AnalyticsSettings {
	const google = env.GA_MEASUREMENT_ID?.trim() || null;
	if (google && !TAG_ID.test(google)) {
		throw new Error(`GA_MEASUREMENT_ID "${google}" is not a measurement ID (G-XXXXXXXXXX)`);
	}

	const websiteId = env.UMAMI_WEBSITE_ID?.trim() || null;
	if (websiteId && !UUID.test(websiteId)) {
		throw new Error(
			`UMAMI_WEBSITE_ID "${websiteId}" is not the UUID the Umami dashboard shows for the site`
		);
	}
	const host = env.UMAMI_HOST?.trim().replace(/\/+$/, '') || UMAMI_CLOUD;
	if (!ORIGIN.test(host)) {
		throw new Error(
			`UMAMI_HOST "${host}" must be an https origin with no path, e.g. https://umami.example.com`
		);
	}

	return { google, umami: websiteId ? { websiteId, host } : null };
}
