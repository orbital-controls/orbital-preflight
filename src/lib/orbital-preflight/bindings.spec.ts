import { describe, expect, it } from 'vitest';
import { clashingActions, filterCounts, findHolders, resolve } from './bindings.ts';
import type { Action, Bind, BindingMap } from './types.ts';

const action = (id: string, mode: Action['mode'] = 'ship'): Action => ({
	id,
	name: id,
	category: 'Test',
	mode
});
const key = (code: string): Bind => ({ input: { kind: 'key', code } });

const actions = [action('Gear'), action('Lights'), action('Scoop'), action('Jump', 'foot')];
const original: BindingMap = {
	Gear: [key('KeyL'), null],
	Lights: [key('KeyK'), null],
	Scoop: [null, null],
	Jump: [key('KeyL'), null]
};

describe('clashes', () => {
	it('finds actions sharing a bind within a mode only', () => {
		const bindings = { ...original, Lights: [key('KeyL'), null] } satisfies BindingMap;
		expect([...clashingActions(actions, bindings, 'ship')].sort()).toEqual(['Gear', 'Lights']);
		expect(clashingActions(actions, bindings, 'foot').size).toBe(0);
	});

	it('treats a modifier as part of the bind', () => {
		const bindings: BindingMap = {
			...original,
			Lights: [
				{ input: { kind: 'key', code: 'KeyL' }, modifiers: [{ kind: 'key', code: 'ShiftLeft' }] },
				null
			]
		};
		expect(clashingActions(actions, bindings, 'ship').size).toBe(0);
	});

	it('lists holders, skipping the slot being rebound', () => {
		expect(findHolders(actions, original, 'ship', key('KeyL'))).toEqual([
			{ actionId: 'Gear', slot: 0 }
		]);
		expect(
			findHolders(actions, original, 'ship', key('KeyL'), { actionId: 'Gear', slot: 0 })
		).toEqual([]);
	});
});

describe('resolve', () => {
	const target = { actionId: 'Lights', slot: 0 } as const;

	it('Move takes the bind and empties the other slot', () => {
		const next = resolve(original, original, actions, target, { kind: 'move' }, key('KeyL'));
		expect(next.Lights).toEqual([key('KeyL'), null]);
		expect(next.Gear).toEqual([null, null]);
		expect(next.Jump).toEqual(original.Jump);
	});

	it('Swap gives the other action the old bind', () => {
		const next = resolve(original, original, actions, target, { kind: 'swap' }, key('KeyL'));
		expect(next.Lights).toEqual([key('KeyL'), null]);
		expect(next.Gear).toEqual([key('KeyK'), null]);
	});

	it('Keep both leaves the clash in place', () => {
		const next = resolve(original, original, actions, target, { kind: 'keep-both' }, key('KeyL'));
		expect(next.Gear).toEqual(original.Gear);
		expect(clashingActions(actions, next, 'ship').size).toBe(2);
	});

	it('Clear and Back to file', () => {
		const cleared = resolve(original, original, actions, target, { kind: 'clear' }, null);
		expect(cleared.Lights).toEqual([null, null]);
		const back = resolve(cleared, original, actions, target, { kind: 'revert' }, null);
		expect(back.Lights).toEqual(original.Lights);
	});

	it('never mutates its inputs', () => {
		const copy = structuredClone(original);
		resolve(original, original, actions, target, { kind: 'swap' }, key('KeyL'));
		expect(original).toEqual(copy);
	});
});

describe('filter counts', () => {
	it('counts all, unbound, clashes and changed per mode', () => {
		const bindings: BindingMap = { ...original, Lights: [key('KeyL'), null] };
		expect(filterCounts(actions, bindings, original, 'ship')).toEqual({
			all: 3,
			unbound: 1,
			clashes: 2,
			changed: 1
		});
		expect(filterCounts(actions, bindings, original, 'foot')).toEqual({
			all: 1,
			unbound: 0,
			clashes: 0,
			changed: 0
		});
	});
});

describe('contexts', () => {
	it('menu binds share keys with flight binds without clashing', () => {
		const withMenu = [...actions, { ...action('UI_Up'), context: 'menus' }];
		const bindings: BindingMap = { ...original, UI_Up: [key('KeyL'), null] };
		expect(clashingActions(withMenu, bindings, 'ship').size).toBe(0);
		expect(
			findHolders(withMenu, bindings, 'ship', key('KeyL'), { actionId: 'UI_Up', slot: 0 })
		).toEqual([]);
	});
});

describe('resolve with an existing clash', () => {
	it('Swap and Move touch the first holder only', () => {
		const bindings: BindingMap = {
			...original,
			Lights: [key('KeyL'), null],
			Scoop: [key('KeyV'), null]
		};
		const target = { actionId: 'Scoop', slot: 0 } as const;
		const swapped = resolve(bindings, original, actions, target, { kind: 'swap' }, key('KeyL'));
		expect(swapped.Gear).toEqual([key('KeyV'), null]);
		expect(swapped.Lights).toEqual([key('KeyL'), null]);
		const moved = resolve(bindings, original, actions, target, { kind: 'move' }, key('KeyL'));
		expect(moved.Gear).toEqual([null, null]);
		expect(moved.Lights).toEqual([key('KeyL'), null]);
	});
});
