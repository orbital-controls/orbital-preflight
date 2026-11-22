import { clashingActions } from './bindings.ts';
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
	},
	{
		// The same toggle in SRV mode: chase camera or the driver's seat. Binds are per mode,
		// so the SRV needs its own action; the view itself is shared with the ship's.
		action: {
			id: 'OrbitalPreflightToggleCameraSrv',
			name: 'Toggle camera',
			category: 'Panels',
			mode: 'srv',
			effect: 'camera',
			local: true
		},
		// K again: free in the SRV in the shipped presets. UNVERIFIED against Elite's defaults.
		binding: [{ input: { kind: 'key', code: 'KeyK' } }, null]
	}
];

/**
 * `parsed` with the local actions added, unless the file already has one by that id, and
 * only in modes the sim has (X4 has no SRV, so no SRV tab for a camera toggle alone). A
 * default bind the file already uses in that mode is left off, so adding the action never
 * creates a clash or makes an existing key fire twice.
 */
export function withLocalActions(parsed: ParsedBinds): ParsedBinds {
	const modes = new Set(parsed.actions.map((a) => a.mode));
	const extra = LOCAL_ACTIONS.filter(
		({ action }) => !(action.id in parsed.bindings) && modes.has(action.mode)
	);
	if (!extra.length) return parsed;
	const actions = [...parsed.actions, ...extra.map((e) => e.action)];
	const bindings = {
		...parsed.bindings,
		...Object.fromEntries(extra.map((e) => [e.action.id, e.binding]))
	};
	for (const { action } of extra) {
		if (clashingActions(actions, bindings, action.mode).has(action.id))
			bindings[action.id] = [null, null];
	}
	return { ...parsed, actions, bindings };
}
