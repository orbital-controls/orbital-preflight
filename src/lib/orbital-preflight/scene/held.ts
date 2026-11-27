import type { Action, BindingMap, InputId } from '../types.ts';

/** Nothing held. */
export const NO_HELD: ReadonlySet<string> = new Set();

/**
 * The effects of the actions in `actions` with a bind held down now: a slot counts when
 * its input and every modifier it needs are down. Axis actions don't count (they read as
 * analogue axes). Pure: `isDown` says whether an input is down.
 */
export function heldEffects(
	actions: readonly Action[],
	bindings: BindingMap,
	isDown: (input: InputId) => boolean
): ReadonlySet<string> {
	const out = new Set<string>();
	for (const action of actions) {
		if (!action.effect || action.axis) continue;
		for (const slot of bindings[action.id] ?? []) {
			if (!slot || !isDown(slot.input)) continue;
			if ((slot.modifiers ?? []).every(isDown)) {
				out.add(action.effect);
				break;
			}
		}
	}
	return out;
}
