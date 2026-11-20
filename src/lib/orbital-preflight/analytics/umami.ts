/** The browser half of Umami. The script itself is in the head (`snippet.ts`). */

export const UMAMI_SCRIPT_ID = 'op-umami';

type Payload = Record<string, unknown>;

interface UmamiWindow {
	umami?: {
		track: (
			name?: string | Payload | ((payload: Payload) => Payload),
			data?: Record<string, unknown>
		) => Promise<void>;
	};
}

/**
 * Whether this build wrote the script. Not whether it loaded: a blocked request leaves
 * the element and no `window.umami`, which the optional calls below allow for.
 */
export function scriptPresent(): boolean {
	return typeof document !== 'undefined' && document.getElementById(UMAMI_SCRIPT_ID) !== null;
}

function umami(): UmamiWindow['umami'] {
	// SAFETY: `umami` is installed by the tracker script, so it is not on the DOM's
	// `Window` type. It stays undefined when the script was blocked.
	return (window as unknown as UmamiWindow).umami;
}

/**
 * The function form keeps the tracker's own defaults (website ID, screen, language,
 * referrer) and overrides only the URL and title.
 */
export function pageView(location: string, title: string): void {
	umami()?.track((payload) => ({ ...payload, url: location, title }));
}

export function event(name: string, data: Record<string, string | number | boolean>): void {
	umami()?.track(name, data);
}
