import type { ResolvedAnalytics } from '../config.ts';
import { consentKey } from './consent.ts';
import { GA_LOADER, GA_SCRIPT_ID } from './gtag.ts';
import { UMAMI_SCRIPT_ID } from './umami.ts';

/**
 * The analytics tags, as HTML written into the `<head>` of the prerendered page by
 * `src/hooks.server.ts` (which runs at build time only: the site stays static).
 *
 * In the served file rather than added after hydration, so Consent Mode defaults exist
 * before the app runs and an installation check finds the tag. The IDs were validated by
 * `resolveConfig`; nothing here escapes them.
 *
 * Empty when the config sets no IDs: no tag, no cookie, no request, which is what a fork
 * that hasn't opted in ships.
 */
export function analyticsHead(analytics: ResolvedAnalytics, base: string): string {
	return [googleSnippet(analytics.google, base), umamiSnippet(analytics.umami)]
		.filter(Boolean)
		.join('\n\t\t');
}

/**
 * The Google tag, with two departures from the snippet Google hands out:
 *
 * - The remote `gtag/js` script is not requested until consent is granted. The inline
 *   part only creates the queue and a loader; a returning visitor who already allowed it
 *   loads the tag at once, and everyone else contacts no Google endpoint.
 * - `send_page_view` is off. Page views are sent from `Analytics.svelte` after
 *   navigation, so leaving it on would count the first one twice.
 */
export function googleSnippet(id: string | null, base: string): string {
	if (!id) return '';
	return [
		'<!-- Google tag (gtag.js), loaded only after consent -->',
		'<script>',
		'\twindow.dataLayer = window.dataLayer || [];',
		'\tfunction gtag() { dataLayer.push(arguments); }',
		"\tvar consent = 'denied';",
		'\ttry {',
		`\t\tif (localStorage.getItem(${JSON.stringify(consentKey(base))}) === 'granted') consent = 'granted';`,
		'\t} catch (e) {}',
		"\tgtag('consent', 'default', {",
		"\t\tad_storage: 'denied',",
		"\t\tad_user_data: 'denied',",
		"\t\tad_personalization: 'denied',",
		'\t\tanalytics_storage: consent',
		'\t});',
		"\tgtag('js', new Date());",
		`\tgtag('config', '${id}', { send_page_view: false });`,
		`\twindow.${GA_LOADER} = function () {`,
		`\t\tif (document.getElementById('${GA_SCRIPT_ID}')) return;`,
		"\t\tvar tag = document.createElement('script');",
		'\t\ttag.async = true;',
		`\t\ttag.id = '${GA_SCRIPT_ID}';`,
		`\t\ttag.src = 'https://www.googletagmanager.com/gtag/js?id=${id}';`,
		'\t\tdocument.head.appendChild(tag);',
		'\t};',
		`\tif (consent === 'granted') window.${GA_LOADER}();`,
		'</script>'
	].join('\n\t\t');
}

/**
 * Umami: no cookie, no stored identifier, so no consent and no banner. It measures the
 * visitors whose blockers drop the Google tag; the two together bracket the real figure.
 *
 * `data-auto-pageview="false"` for the same reason as `send_page_view: false`. No queue
 * stub: the tracker installs itself with `if (!window.umami)`, so a placeholder would
 * stop the real one loading.
 */
export function umamiSnippet(umami: ResolvedAnalytics['umami']): string {
	if (!umami) return '';
	return [
		'<!-- Umami, cookieless -->',
		`<script defer id="${UMAMI_SCRIPT_ID}" data-website-id="${umami.websiteId}" data-auto-pageview="false" src="${umami.host}/script.js"></script>`
	].join('\n\t\t');
}
