import { readConsent, writeConsent, type ConsentChoice } from './analytics/consent.ts';
import { tagConfigured, updateConsent } from './analytics/gtag.ts';
import { scriptPresent } from './analytics/umami.ts';

/**
 * The visitor's answer to Google Analytics. Read from the browser store after hydration,
 * so the prerendered page and the first client render agree and a visitor who already
 * answered never sees the banner flash.
 */
export class ConsentState {
	#choice = $state<ConsentChoice | undefined>(undefined);
	#ready = $state(false);
	#measured = $state(false);
	#cookieless = $state(false);

	constructor(private readonly base: string) {}

	/**
	 * Whether to ask. Never in a build with no Google tag: there is no cookie to ask about.
	 */
	get pending(): boolean {
		return this.#ready && this.#measured && this.#choice === undefined;
	}

	/** Whether Umami counts visits either way, which the banner then says. */
	get cookieless(): boolean {
		return this.#cookieless;
	}

	hydrate(): void {
		if (this.#ready) return;
		this.#choice = readConsent(this.base);
		// The inline bootstrap, not the remote tag, which is absent until a grant.
		this.#measured = tagConfigured();
		this.#cookieless = scriptPresent();
		this.#ready = true;
	}

	answer(choice: ConsentChoice): void {
		this.#choice = choice;
		writeConsent(this.base, choice);
		updateConsent(choice);
	}
}
