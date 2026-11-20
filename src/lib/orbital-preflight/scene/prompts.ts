import type { Action, Bind, BindingMap } from '../types.ts';
import type { PromptSpec, Stop } from './pad.ts';

/** One line of a stop's on-screen prompt, with the pilot's current binds. */
export interface PromptRow {
	label: string;
	/** Key chips, in order; empty when nothing is bound. */
	keys: string[];
	bound: boolean;
	hold: boolean;
}

/**
 * A stop's prompt lines, labelled with the binds in `bindings` (the first bound slot of
 * each matching action, one chip per action). `label` names a bind ("F", "Mouse 1").
 * Pure, so the HUD and the tests read the same thing.
 */
export function stopPrompts(
	stop: Stop,
	actions: readonly Action[],
	bindings: BindingMap,
	label: (bind: Bind) => string
): PromptRow[] {
	return stop.prompts.map((spec) => row(spec, actions, bindings, label));
}

function row(
	spec: PromptSpec,
	actions: readonly Action[],
	bindings: BindingMap,
	label: (bind: Bind) => string
): PromptRow {
	const keys: string[] = [];
	if (spec.fixed) keys.push(spec.fixed);
	const wanted = (a: Action) =>
		!a.axis &&
		((a.effect !== undefined && spec.effects?.includes(a.effect)) || spec.names?.includes(a.name));
	// In the spec's order, so Move reads W A S D rather than the catalogue's order.
	const order = (a: Action) => {
		const i = spec.effects?.indexOf(a.effect ?? '') ?? -1;
		return i >= 0 ? i : (spec.names?.indexOf(a.name) ?? 0);
	};
	const matches = actions.filter(wanted).sort((a, b) => order(a) - order(b));
	for (const action of matches) {
		const slot = (bindings[action.id] ?? []).find((s): s is Bind => Boolean(s));
		if (!slot) continue;
		const text = label(slot);
		if (!keys.includes(text)) keys.push(text);
	}
	return { label: spec.label, keys, bound: keys.length > 0, hold: Boolean(spec.hold) };
}
