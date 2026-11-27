/**
 * Whether the visitor has agreed to Google Analytics. One value in the browser store;
 * there are no accounts and nothing to sync it to.
 *
 * The key carries the base path, like the remembered layout, so two forks served from
 * one github.io origin ask separately: agreeing to one pilot's analytics is not agreeing
 * to another's.
 */

export type ConsentChoice = 'granted' | 'denied';

/** Also read inline by the head snippet, before the app exists. */
export function consentKey(base: string): string {
	return `orbital-preflight:${base || '/'}:consent`;
}

/** `undefined` means the visitor has not been asked yet, which is what shows the banner. */
export function readConsent(base: string): ConsentChoice | undefined {
	try {
		const raw = localStorage.getItem(consentKey(base));
		return raw === 'granted' || raw === 'denied' ? raw : undefined;
	} catch {
		// Storage blocked or missing. Unanswered is the safe reading: nothing is measured.
		return undefined;
	}
}

export function writeConsent(base: string, choice: ConsentChoice): void {
	try {
		localStorage.setItem(consentKey(base), choice);
	} catch {
		// The choice holds for this visit and is asked again next time.
	}
}
