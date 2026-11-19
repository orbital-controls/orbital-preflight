import type { Action, Binding, ParsedBinds } from './types.ts';

/**
 * Actions Orbital Preflight keeps for itself: the sim has nothing like them, so they're
 * never written to an export (the writer only touches actions the file already has).
 * They're listed, rebindable and clash-checked like the rest.
 */
export const LOCAL_ACTIONS: readonly { action: Action; binding: Binding }[] = [
	{
		action: {
			id: 'OrbitalPreflightToggleCamera',
			name: 'Toggle camera',
			category: 'Panels',
			mode: 'ship',
			effect: 'camera',
			local: true
		},
		// K: free in the shipped presets and in Elite's own defaults as far as we know. UNVERIFIED.
		binding: [{ input: { kind: 'key', code: 'KeyK' } }, null]
	}
];

/** `parsed` with the local actions added, unless the file already has one by that id. */
export function withLocalActions(parsed: ParsedBinds): ParsedBinds {
	const extra = LOCAL_ACTIONS.filter(({ action }) => !(action.id in parsed.bindings));
	if (!extra.length) return parsed;
	return {
		...parsed,
		actions: [...parsed.actions, ...extra.map((e) => e.action)],
		bindings: {
			...parsed.bindings,
			...Object.fromEntries(extra.map((e) => [e.action.id, e.binding]))
		}
	};
}
