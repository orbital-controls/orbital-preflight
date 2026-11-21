// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/** The deploy base path, from BASE_PATH at build time. */
	const __OP_BASE__: string;
	/** Test builds only: `later` sims that stand in with Elite files (sims/index.ts). */
	const __OP_MOCK_SIMS__: string[];
}

export {};
