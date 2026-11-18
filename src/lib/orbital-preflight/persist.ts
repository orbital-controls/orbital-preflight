import type { BindingMap, SimId } from './types.ts';

/**
 * "Remember this layout on this browser". The key carries the base path, so two forks
 * served from one github.io origin (`/alice-binds/`, `/bob-binds/`) keep separate copies.
 * Every call is wrapped: storage can be full, blocked or missing, and none of that should
 * stop the app.
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
	savedAt: string;
}

export function storageKey(base: string): string {
	return `orbital-preflight:${base || '/'}:layout`;
}

function storage(): Storage | null {
	try {
		return typeof localStorage === 'undefined' ? null : localStorage;
	} catch {
		return null;
	}
}

export function saveLayout(base: string, layout: Omit<RememberedLayout, 'version' | 'savedAt'>): boolean {
	try {
		const value: RememberedLayout = { version: 1, savedAt: new Date().toISOString(), ...layout };
		storage()?.setItem(storageKey(base), JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}

export function loadLayout(base: string): RememberedLayout | null {
	try {
		const raw = storage()?.getItem(storageKey(base));
		if (!raw) return null;
		const value = JSON.parse(raw) as Partial<RememberedLayout>;
		if (value.version !== 1 || typeof value.source !== 'string' || !value.sim) return null;
		return value as RememberedLayout;
	} catch {
		return null;
	}
}

export function clearLayout(base: string): void {
	try {
		storage()?.removeItem(storageKey(base));
	} catch {
		// Nothing to clear, or nothing we can do about it.
	}
}
