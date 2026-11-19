import { describe, expect, it } from 'vitest';
import { hatDirections, matchDevice, parseGamepadId } from './gamepad.ts';

describe('Gamepad.id', () => {
	it('reads Chrome and Firefox ids', () => {
		expect(parseGamepadId('T.16000M (Vendor: 044f Product: b10a)')).toEqual({
			name: 'T.16000M',
			vendor: '044f',
			product: 'b10a'
		});
		expect(
			parseGamepadId('Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e Product: 028e)')
		).toMatchObject({
			vendor: '045e',
			product: '028e'
		});
		expect(parseGamepadId('44f-b10a-T.16000M')).toEqual({
			name: 'T.16000M',
			vendor: '044f',
			product: 'b10a'
		});
		expect(parseGamepadId('Some Stick')).toEqual({ name: 'Some Stick' });
	});

	it('pairs by USB id, one controller per device', () => {
		const devices = [
			{ id: 'T16000M', name: 'T.16000M', vendor: '044f', product: 'b10a' },
			{ id: '231D0200', name: 'VKB', vendor: '231d', product: '0200' }
		];
		expect(
			matchDevice('VKBsim Gladiator (Vendor: 231d Product: 0200)', devices, new Set())?.id
		).toBe('231D0200');
		expect(matchDevice('44f-b10a-T.16000M', devices, new Set(['T16000M']))).toBeNull();
	});

	it('reads Chrome hat axes', () => {
		expect(hatDirections(-1)).toEqual(['up']);
		expect(hatDirections(-3 / 7)).toEqual(['right']);
		expect(hatDirections(5 / 7)).toEqual(['left']);
		expect(hatDirections(1.2857)).toEqual([]);
	});
});
