import type { Action, Bind, Binding, BindingMap, InputId, Mode, Slot, SlotIndex } from './types.ts';

/** A stable string for an input, for comparing and indexing. */
export function inputKey(input: InputId): string {
	switch (input.kind) {
		case 'key':
			return `key:${input.code}`;
		case 'mouse':
			return `mouse:${input.button}`;
		case 'wheel':
			return `wheel:${input.dir}`;
		case 'button':
			return `button:${input.deviceId}:${input.button}`;
		case 'hat':
			return `hat:${input.deviceId}:${input.hat}:${input.dir}`;
		case 'axis':
			return `axis:${input.deviceId}:${input.axis}${input.half ? `:${input.half}` : ''}`;
		case 'raw':
			return `raw:${input.device}:${input.key}`;
	}
}

export function bindKey(bind: Bind): string {
	return bind.modifier
		? `${inputKey(bind.modifier)}+${inputKey(bind.input)}`
		: inputKey(bind.input);
}

export function sameInput(a: InputId | null | undefined, b: InputId | null | undefined): boolean {
	if (!a || !b) return !a && !b;
	return inputKey(a) === inputKey(b);
}

export function sameBind(a: Slot, b: Slot): boolean {
	if (!a || !b) return !a && !b;
	return bindKey(a) === bindKey(b);
}

export function sameBinding(a: Binding, b: Binding): boolean {
	return sameBind(a[0], b[0]) && sameBind(a[1], b[1]);
}

export function isUnbound(binding: Binding | undefined): boolean {
	return !binding || (!binding[0] && !binding[1]);
}

export interface SlotRef {
	actionId: string;
	slot: SlotIndex;
}

/**
 * Every slot in `mode` that holds `bind`, except `except`. Binds only clash within a
 * mode: the game reads ship, SRV and on-foot binds in different contexts, so the same
 * key in two of them is normal.
 */
export function findHolders(
	actions: Action[],
	bindings: BindingMap,
	mode: Mode,
	bind: Bind,
	except?: SlotRef
): SlotRef[] {
	const key = bindKey(bind);
	const holders: SlotRef[] = [];
	for (const action of actions) {
		if (action.mode !== mode) continue;
		const binding = bindings[action.id];
		if (!binding) continue;
		([0, 1] as const).forEach((slot) => {
			const held = binding[slot];
			if (!held || bindKey(held) !== key) return;
			if (except && except.actionId === action.id && except.slot === slot) return;
			holders.push({ actionId: action.id, slot });
		});
	}
	return holders;
}

/** Action ids in `mode` that share a bind with another action in the same mode. */
export function clashingActions(actions: Action[], bindings: BindingMap, mode: Mode): Set<string> {
	const byBind = new Map<string, Set<string>>();
	for (const action of actions) {
		if (action.mode !== mode) continue;
		for (const slot of bindings[action.id] ?? []) {
			if (!slot) continue;
			const key = bindKey(slot);
			const set = byBind.get(key) ?? new Set();
			set.add(action.id);
			byBind.set(key, set);
		}
	}
	const clashing = new Set<string>();
	for (const ids of byBind.values()) if (ids.size > 1) ids.forEach((id) => clashing.add(id));
	return clashing;
}

/** How the rebind card settles a candidate. */
export type Resolution =
	| { kind: 'apply' } // the candidate was free
	| { kind: 'move' } // take it from the other action, leaving its slot empty
	| { kind: 'swap' } // give the other action this slot's old bind
	| { kind: 'keep-both' } // bind it here too, and live with the clash
	| { kind: 'clear' }
	| { kind: 'revert' }; // back to what the file had

function setSlot(bindings: BindingMap, ref: SlotRef, value: Slot): BindingMap {
	const current = bindings[ref.actionId] ?? [null, null];
	const next: Binding = [current[0], current[1]];
	next[ref.slot] = value;
	return { ...bindings, [ref.actionId]: next };
}

/**
 * The bindings after settling `target` with `resolution`. Pure: returns a new map and
 * never touches `bindings` or `original`.
 */
export function resolve(
	bindings: BindingMap,
	original: BindingMap,
	actions: Action[],
	target: SlotRef,
	resolution: Resolution,
	candidate: Bind | null
): BindingMap {
	const mode = actions.find((a) => a.id === target.actionId)?.mode;
	switch (resolution.kind) {
		case 'clear':
			return setSlot(bindings, target, null);
		case 'revert':
			return setSlot(bindings, target, original[target.actionId]?.[target.slot] ?? null);
		case 'apply':
		case 'keep-both':
			if (!candidate) return bindings;
			return setSlot(bindings, target, candidate);
		case 'move':
		case 'swap': {
			if (!candidate || !mode) return bindings;
			const previous = bindings[target.actionId]?.[target.slot] ?? null;
			const holders = findHolders(actions, bindings, mode, candidate, target);
			let next = setSlot(bindings, target, candidate);
			for (const holder of holders) {
				next = setSlot(next, holder, resolution.kind === 'swap' ? previous : null);
			}
			return next;
		}
	}
}

export type ShowFilter = 'all' | 'unbound' | 'clashes' | 'changed';

export interface FilterCounts {
	all: number;
	unbound: number;
	clashes: number;
	changed: number;
}

export function filterCounts(
	actions: Action[],
	bindings: BindingMap,
	original: BindingMap,
	mode: Mode
): FilterCounts {
	const inMode = actions.filter((a) => a.mode === mode);
	const clashing = clashingActions(actions, bindings, mode);
	return {
		all: inMode.length,
		unbound: inMode.filter((a) => isUnbound(bindings[a.id])).length,
		clashes: clashing.size,
		changed: inMode.filter((a) => isChanged(bindings, original, a.id)).length
	};
}

export function isChanged(bindings: BindingMap, original: BindingMap, actionId: string): boolean {
	const now = bindings[actionId];
	const then = original[actionId];
	if (!now || !then) return Boolean(now) !== Boolean(then);
	return !sameBinding(now, then);
}

export function matchesFilter(
	filter: ShowFilter,
	action: Action,
	bindings: BindingMap,
	original: BindingMap,
	clashing: Set<string>
): boolean {
	switch (filter) {
		case 'all':
			return true;
		case 'unbound':
			return isUnbound(bindings[action.id]);
		case 'clashes':
			return clashing.has(action.id);
		case 'changed':
			return isChanged(bindings, original, action.id);
	}
}
