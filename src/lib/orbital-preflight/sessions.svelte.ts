/* eslint-disable svelte/prefer-svelte-reactivity -- the session Map is never mutated: it is
   replaced whole in a $state.raw, and the derived per-game counts are fresh Maps. */
import { BindStore } from './binds.svelte.ts';
import type { PadPairing } from './inputs/hub.svelte.ts';
import { MODES, type Mode, type SimId } from './types.ts';

/**
 * One game while the tab is open: its file (or the pilot's preset, or a remembered
 * layout), the file as loaded and as edited (both in `store`, with the parsed document
 * the writer splices into), the mode it was left in and how controllers were paired
 * with its file's devices. Switching games never discards any of it.
 */
export class Session {
	readonly store = new BindStore();
	mode = $state<Mode>('ship');
	/** "Remember this layout on this browser", for this game alone. */
	remember = $state(false);
	/**
	 * Controller pairing as it was when this game was last current. The hub holds the
	 * live pairing for the current game; this is the copy kept while another is.
	 */
	pairing: PadPairing[] = [];

	/** The modes this game's file has actions in, in tab order. */
	modes = $derived(MODES.filter((m) => this.store.actions.some((a) => a.mode === m)));

	constructor(readonly sim: SimId) {}
}

/**
 * Every game loaded this visit, and which one is current. `currentSim` can name a game
 * with no session yet: picked in the bay or the manifest, waiting for its file.
 */
export class Sessions {
	#sessions = $state.raw(new Map<SimId, Session>());
	currentSim = $state<SimId | null>(null);

	current = $derived(this.currentSim ? (this.#sessions.get(this.currentSim) ?? null) : null);

	/** Unsaved changes per loaded game, across all of its modes. */
	changesBySim = $derived(
		new Map([...this.#sessions].map(([sim, s]) => [sim, s.store.changes] as const))
	);

	/** Unsaved changes across every game: what Leave counts. */
	totalChanges = $derived([...this.changesBySim.values()].reduce((sum, n) => sum + n, 0));

	get sessions(): ReadonlyMap<SimId, Session> {
		return this.#sessions;
	}

	get(sim: SimId): Session | undefined {
		return this.#sessions.get(sim);
	}

	/** The game's session, made empty if it has none yet. Doesn't change `currentSim`. */
	open(sim: SimId, setup?: (session: Session) => void): Session {
		const existing = this.#sessions.get(sim);
		if (existing) return existing;
		const session = new Session(sim);
		setup?.(session);
		this.#sessions = new Map([...this.#sessions, [sim, session]]);
		return session;
	}
}
