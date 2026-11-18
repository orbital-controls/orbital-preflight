import type { OrbitalPreflight } from '#lib/orbital-preflight/app.svelte.ts';
import { bindKey, inputKey } from '#lib/orbital-preflight/bindings.ts';
import type { InputId } from '#lib/orbital-preflight/types.ts';

export interface KeyOwners {
	names: string[];
	/** Two actions in one context share this exact bind (modifier included). */
	clash: boolean;
}

/** What each input does in the current mode, for lighting and labelling deck keys. */
export function ownersByInput(app: OrbitalPreflight): Map<string, KeyOwners> {
	const map = new Map<string, KeyOwners>();
	const seen = new Map<string, number>();
	for (const action of app.store.actionsIn(app.mode)) {
		for (const slot of app.store.bindings[action.id] ?? []) {
			if (!slot) continue;
			const key = inputKey(slot.input);
			const owners = map.get(key) ?? { names: [], clash: false };
			if (!owners.names.includes(action.name)) owners.names.push(action.name);
			const exact = `${action.context ?? ''}|${bindKey(slot)}`;
			seen.set(exact, (seen.get(exact) ?? 0) + 1);
			if ((seen.get(exact) ?? 0) > 1) owners.clash = true;
			map.set(key, owners);
		}
	}
	return map;
}

/** A tap on the deck: the same path as a real key, so listening and the flight both see it. */
export function tap(app: OrbitalPreflight, input: InputId) {
	app.hub.press(input);
	setTimeout(() => app.hub.release(input), 140);
}
