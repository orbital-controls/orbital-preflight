import { describe, expect, it } from 'vitest';
import { deviceDecks } from './deck.ts';
import { bindLabel, deviceRoles, inputLabel } from './labels.ts';

const roles = deviceRoles([
	{ id: 'T16000M', name: 'Thrustmaster T.16000M' },
	{ id: 'T16000MTHROTTLE', name: 'Thrustmaster TWCS Throttle' },
	{ id: '231D0200', name: 'VKB 0200' }
]);

describe('labels', () => {
	it('names sticks and throttles, numbering repeats', () => {
		expect(roles.map((r) => r.long)).toEqual(['Stick 1', 'Throttle', 'Stick 2']);
		expect(deviceRoles([{ id: 'X', name: 'Stick' }])[0].short).toBe('Stk');
	});

	it('prints inputs short and long, as on the boards', () => {
		expect(inputLabel({ kind: 'key', code: 'KeyW' }, roles)).toBe('W');
		expect(inputLabel({ kind: 'key', code: 'ShiftLeft' }, roles)).toBe('Shift');
		expect(inputLabel({ kind: 'mouse', button: 0 }, roles, true)).toBe('Mouse LMB');
		expect(inputLabel({ kind: 'button', deviceId: 'T16000M', button: 1 }, roles)).toBe('Stk1 TRG');
		expect(
			inputLabel({ kind: 'button', deviceId: 'T16000MTHROTTLE', button: 5 }, roles, true)
		).toBe('Throttle B5');
		expect(inputLabel({ kind: 'hat', deviceId: 'T16000M', hat: 1, dir: 'up' }, roles)).toBe(
			'Stk1 H↑'
		);
		expect(
			bindLabel(
				{ input: { kind: 'key', code: 'KeyZ' }, modifier: { kind: 'key', code: 'ShiftLeft' } },
				roles
			)
		).toBe('Shift+Z');
		expect(bindLabel(null, roles)).toBe('—');
	});

	it('lays out a deck per device with hats and buttons', () => {
		const decks = deviceDecks(roles.slice(0, 2), {
			A: [{ input: { kind: 'button', deviceId: 'T16000MTHROTTLE', button: 12 } }, null]
		});
		expect(decks[0].inputs).toHaveLength(4 + 6);
		expect(decks[1].inputs).toHaveLength(7);
		expect(decks[1].inputs.at(-1)).toEqual({
			kind: 'button',
			deviceId: 'T16000MTHROTTLE',
			button: 12
		});
	});
});
