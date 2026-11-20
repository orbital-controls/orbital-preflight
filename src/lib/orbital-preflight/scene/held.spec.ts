import { describe, expect, it } from 'vitest';
import { inputKey } from '../bindings.ts';
import type { Action, BindingMap, InputId } from '../types.ts';
import { heldEffects } from './held.ts';

const key = (code: string): InputId => ({ kind: 'key', code });
const action = (id: string, effect: string, axis = false): Action => ({
	id,
	name: id,
	category: 'Moving',
	mode: 'foot',
	effect,
	...(axis && { axis: true })
});

describe('held effects', () => {
	const actions = [
		action('Fwd', 'walkF'),
		action('Sprint', 'sprint'),
		action('Left', 'walkL'),
		action('Axis', 'walkF', true)
	];
	const bindings: BindingMap = {
		Fwd: [{ input: key('KeyW') }, { input: key('ArrowUp') }],
		Sprint: [{ input: key('KeyR'), modifiers: [key('ShiftLeft')] }, null],
		Left: [{ input: key('KeyA') }, null],
		Axis: [{ input: { kind: 'axis', deviceId: 'pad', axis: 'Y' } }, null]
	};
	const down = (...codes: string[]) => {
		const set = new Set(codes.map((c) => inputKey(key(c))));
		return (input: InputId) => set.has(inputKey(input));
	};

	it('lists the effects of actions with a held slot, either slot', () => {
		expect([...heldEffects(actions, bindings, down('KeyW', 'KeyA'))].sort()).toEqual([
			'walkF',
			'walkL'
		]);
		expect([...heldEffects(actions, bindings, down('ArrowUp'))]).toEqual(['walkF']);
	});

	it('needs every modifier held', () => {
		expect(heldEffects(actions, bindings, down('KeyR')).has('sprint')).toBe(false);
		expect(heldEffects(actions, bindings, down('KeyR', 'ShiftLeft')).has('sprint')).toBe(true);
	});

	it('ignores axis actions', () => {
		const axisDown = () => true;
		expect(heldEffects([actions[3]], bindings, axisDown).size).toBe(0);
	});
});
