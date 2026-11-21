import type { BindingMap, Mode, SimId } from './types.ts';

/**
 * "Remember this layout on this browser", one entry per sim. The key carries the base
 * path, so two forks served from one github.io origin (`/alice-binds/`, `/bob-binds/`)
 * keep separate copies, and the sim id, so each game is remembered (and forgotten) on
 * its own. Every call is wrapped: storage can be full, blocked or missing, and none of
 * that should stop the app.
 */

export interface RememberedLayout {
	version: 1;
	sim: SimId;
	/** What the "Binding for" block shows. */
	label: string;
	/** The file as it was loaded: the export splices into this. */
	source: string;
	/** Only the actions that differ from `source`. */
	edits: BindingMap;
	/** The mode it was left in. */
	mode?: Mode;
	/** Updated whenever it is saved, and when the game becomes current: the newest opens first. */
	savedAt: string;
}

export function storageKey(base: string, sim: SimId): string {
	return `orbital-preflight:${base || '/'}:${sim}`;
}

/** The single-game key used before sessions, read once and moved to its sim's key. */
function legacyKey(base: string): string {
	return `orbital-preflight:${base || '/'}:layout`;
}

function storage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

let lastSaved = 0;

export function saveLayout(
	base: string,
	layout: Omit<RememberedLayout, 'version' | 'savedAt'>
): boolean {
	try {
		// Strictly later than the last save in this tab, so two saves in one millisecond
		// (switching games, then editing) still say which game was current last.
		lastSaved = Math.max(Date.now(), lastSaved + 1);
		const value: RememberedLayout = {
			version: 1,
			savedAt: new Date(lastSaved).toISOString(),
			...layout
		};
		storage()?.setItem(storageKey(base, layout.sim), JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

function read(raw: string | null | undefined): RememberedLayout | null {
	if (!raw) return null;
	const value = JSON.parse(raw) as Partial<RememberedLayout>;
	if (value.version !== 1 || typeof value.source !== 'string' || !value.sim) return null;
	return value as RememberedLayout;
}

export function loadLayout(base: string, sim: SimId): RememberedLayout | null {
	try {
		return read(storage()?.getItem(storageKey(base, sim)));
	} catch {
		return null;
	}
}

/** Every remembered game for these sims, newest first. Moves a pre-sessions entry over. */
export function loadLayouts(base: string, sims: readonly SimId[]): RememberedLayout[] {
	try {
		const legacy = read(storage()?.getItem(legacyKey(base)));
		if (legacy) {
			if (!loadLayout(base, legacy.sim)) {
				storage()?.setItem(storageKey(base, legacy.sim), JSON.stringify(legacy));
			}
			storage()?.removeItem(legacyKey(base));
		}
	} catch {
		// A broken old entry is simply not carried over.
	}
	return sims
		.map((sim) => loadLayout(base, sim))
		.filter((l): l is RememberedLayout => l !== null && sims.includes(l.sim))
		.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
}

export function clearLayout(base: string, sim: SimId): void {
	try {
		storage()?.removeItem(storageKey(base, sim));
	} catch {
		// Nothing to clear, or nothing we can do about it.
	}
}
