import { describe, expect, it } from 'vitest';
import type { Action, Bind, BindingMap } from '../types.ts';
import { STOPS } from './pad.ts';
import { stopPrompts } from './prompts.ts';

const act = (id: string, effect?: string, name = id): Action => ({
	id,
	name,
	category: 'Tools',
	mode: 'foot',
	...(effect && { effect })
});
const key = (code: string): Bind => ({ input: { kind: 'key', code } });
const label = (b: Bind) => (b.input.kind === 'key' ? b.input.code.replace('Key', '') : '?');

describe('stop prompts', () => {
	const actions = [
		act('Fwd', 'walkF'),
		act('Back', 'walkB'),
		act('Left', 'walkL'),
		act('Right', 'walkR'),
		act('Sprint', 'sprint'),
		act('Use', 'interact'),
		act('Emote', 'panel', 'Emote wheel')
	];
	const bindings: BindingMap = {
		Fwd: [key('KeyW'), null],
		Back: [null, key('KeyS')],
		Left: [key('KeyA'), null],
		Right: [key('KeyD'), null],
		Sprint: [null, null],
		Use: [key('KeyF'), null],
		Emote: [key('KeyB'), null]
	};
	const at = (n: number) => stopPrompts(STOPS[n - 1], actions, bindings, label);

	it('shows the interact bind at the pad console', () => {
		const [use, hold, scan] = at(6);
		expect(use).toEqual({ label: 'Use console', keys: ['F'], bound: true, hold: false });
		expect(hold).toMatchObject({ keys: ['F'], hold: true });
		expect(scan).toMatchObject({ label: 'Scan', bound: false, keys: [] });
	});

	it('lists movement keys in W A S D order, either slot, and the mouse for look', () => {
		const [move, look, run] = at(1);
		expect(move.keys).toEqual(['W', 'A', 'S', 'D']);
		expect(look.keys).toEqual(['Mouse']);
		// Sprint has no bind: "Not bound".
		expect(run.bound).toBe(false);
	});

	it('matches panel actions by name', () => {
		expect(at(7)[1]).toMatchObject({ label: 'Emote', keys: ['B'] });
	});
});
