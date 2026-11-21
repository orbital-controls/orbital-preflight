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
		expect(a.has).toEqual({ ...NO_ANALOG.has, pitch: true, roll: true });
	});

	it('reads the SRV steering axis centred and the drive axis as a forward lever', () => {
		const srv: Action[] = [
			{
				id: 'SteeringAxis',
				name: 'Steering',
				category: 'Driving',
				mode: 'srv',
				axis: true,
				analog: 'steer'
			},
			{
				id: 'DriveSpeedAxis',
				name: 'Drive speed',
				category: 'Driving',
				mode: 'srv',
				axis: true,
				analog: 'drive'
			}
		];
		const srvBindings: BindingMap = {
			SteeringAxis: [{ input: { kind: 'axis', deviceId: 'T16000M', axis: 'X' } }, null],
			DriveSpeedAxis: [{ input: { kind: 'axis', deviceId: 'THR', axis: 'Z' } }, null]
		};
		const read = (x: number, z: number) =>
			analogAxes(
				srv,
				srvBindings,
				new Map([
					['T16000M:X', x],
					['THR:Z', z]
				])
			);
		expect(read(1, -1)).toMatchObject({ steer: 1, drive: 1 });
		expect(read(-0.03, 1)).toMatchObject({ steer: 0, drive: 0 });
		expect(read(-1, 0).steer).toBe(-1);
		expect(read(-1, 0).drive).toBeCloseTo(0.5);
		expect(read(0, 0).has).toMatchObject({ steer: true, drive: true, pitch: false });
	});

	it('reports nothing for an axis the browser has not seen, or while frozen', () => {
		expect(analogAxes(actions, bindings, new Map()).has.pitch).toBe(false);
		expect(analogAxes(actions, bindings, null)).toBe(NO_ANALOG);
	});
});

describe('on-foot axes', () => {
	it('read move and look axes when bound', () => {
		const actions: Action[] = [
			{ id: 'Fwd', name: 'Move', category: 'Moving', mode: 'foot', axis: true, analog: 'moveY' },
			{ id: 'Look', name: 'Look', category: 'Moving', mode: 'foot', axis: true, analog: 'lookX' }
		];
		const bindings: BindingMap = {
			Fwd: [{ input: { kind: 'axis', deviceId: 'pad', axis: 'Y' } }, null],
			Look: [{ input: { kind: 'axis', deviceId: 'pad', axis: 'RX' } }, null]
		};
		const a = analogAxes(
			actions,
			bindings,
			new Map([
				['pad:Y', -1],
				['pad:RX', 0.5]
			])
		);
		expect(a.moveY).toBe(-1);
		expect(a.lookX).toBeGreaterThan(0.4);
		expect(a.has.moveY && a.has.lookX).toBe(true);
		expect(a.has.moveX).toBe(false);
	});
});

describe('gamepad sticks', () => {
	it('drive the scene like a stick axis; a half does not', () => {
		const axes = new Map([['046D0000:LStickY', 0.8]]);
		const pad: BindingMap = {
			PitchAxisRaw: [{ input: { kind: 'pad', deviceId: '046D0000', control: 'LStickY' } }, null],
			RollAxisRaw: [
				{ input: { kind: 'pad', deviceId: '046D0000', control: 'LStickY', half: 'pos' } },
				null
			],
			YawAxisRaw: [null, null]
		};
		const out = analogAxes(actions, pad, axes);
		expect(out.has.pitch).toBe(true);
		expect(out.pitch).toBeGreaterThan(0.7);
		expect(out.has.roll).toBe(false);
	});
});
