import { describe, expect, it } from 'vitest';
import type { Action, BindingMap } from '../types.ts';
import { analogAxes, NO_ANALOG } from './analog.ts';

const actions: Action[] = [
	{
		id: 'PitchAxisRaw',
		name: 'Pitch',
		category: 'Flight',
		mode: 'ship',
		axis: true,
		analog: 'pitch'
	},
	{ id: 'RollAxisRaw', name: 'Roll', category: 'Flight', mode: 'ship', axis: true, analog: 'roll' },
	{ id: 'YawAxisRaw', name: 'Yaw', category: 'Flight', mode: 'ship', axis: true, analog: 'yaw' }
];
const bindings: BindingMap = {
	PitchAxisRaw: [{ input: { kind: 'axis', deviceId: 'T16000M', axis: 'Y' } }, null],
	RollAxisRaw: [{ input: { kind: 'axis', deviceId: 'T16000M', axis: 'X' } }, null],
	YawAxisRaw: [null, null]
};

describe('analogAxes', () => {
	it('reads bound axes, with a deadzone around centre', () => {
		const axes = new Map([
			['T16000M:Y', -1],
			['T16000M:X', 0.03]
		]);
		const a = analogAxes(actions, bindings, axes);
		expect(a.pitch).toBe(-1);
		expect(a.roll).toBe(0);
		expect(a.has).toEqual({ pitch: true, roll: true, yaw: false });
	});

	it('reports nothing for an axis the browser has not seen, or while frozen', () => {
		expect(analogAxes(actions, bindings, new Map()).has.pitch).toBe(false);
		expect(analogAxes(actions, bindings, null)).toBe(NO_ANALOG);
	});
});
