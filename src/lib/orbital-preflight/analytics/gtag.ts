import type { ConsentChoice } from './consent.ts';

/**
 * The browser half of Google Analytics 4. The queue and the consent-gated loader are in
 * the head (`snippet.ts`); this reports page views and events onto that queue and applies
 * the visitor's answer without a reload.
 */

/** The remote `gtag/js` element, present only once consent has loaded it. */
export const GA_SCRIPT_ID = 'op-gtag';

/** Installed by the inline bootstrap; adds the remote tag. */
export const GA_LOADER = '__orbitalPreflightLoadGoogleAnalytics';

interface GtagWindow {
	dataLayer?: IArguments[];
	__orbitalPreflightLoadGoogleAnalytics?: () => void;
}

function gtagWindow(): GtagWindow {
	// SAFETY: both members are put on the window by the head snippet, so they are not on
	// the DOM's `Window` type. Both are optional, and every use below checks for them.
	return window as unknown as GtagWindow;
}

/**
 * `arguments` rather than a rest array: gtag.js reads its queue in the shape the
 * documented snippet writes, and an array is not that shape.
 */
const gtag = function (): void {
	const target = gtagWindow();
	target.dataLayer = target.dataLayer ?? [];
	// eslint-disable-next-line prefer-rest-params
	target.dataLayer.push(arguments);
} as (...args: unknown[]) => void;

/** Whether this build carries the Google bootstrap, whatever the visitor answered. */
export function tagConfigured(): boolean {
	return typeof window !== 'undefined' && typeof gtagWindow()[GA_LOADER] === 'function';
}

/** Whether consent has added the remote Google tag. */
export function tagPresent(): boolean {
	return typeof document !== 'undefined' && document.getElementById(GA_SCRIPT_ID) !== null;
}

/** On a grant, load the tag and count the page consent was given on. */
export function updateConsent(choice: ConsentChoice): void {
	gtag('consent', 'update', { analytics_storage: choice });
	if (choice !== 'granted') return;
	gtagWindow()[GA_LOADER]?.();
	trackPageView(location.href, document.title);
}

export function trackPageView(location: string, title: string): void {
	gtag('event', 'page_view', { page_location: location, page_title: title });
}

export function trackEvent(name: string, params: Record<string, string | number | boolean>): void {
	gtag('event', name, params);
}
