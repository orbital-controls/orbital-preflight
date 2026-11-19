import { describe, expect, it } from 'vitest';
import { controllerDecks, deviceDecks } from './deck.ts';
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
				{ input: { kind: 'key', code: 'KeyZ' }, modifiers: [{ kind: 'key', code: 'ShiftLeft' }] },
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

describe('controller decks', () => {
	const pad = (index: number, name: string, deviceId: string | null, buttons = 16) => ({
		index,
		id: name,
		name,
		buttons,
		axes: 4,
		deviceId,
		pairedBy: deviceId ? ('usb' as const) : null
	});

	it('has one block per detected controller, named after it', () => {
		const decks = controllerDecks(
			[
				pad(0, 'T.16000M', 'T16000M'),
				pad(1, 'VKBsim Gladiator', null, 30),
				pad(2, 'T.16000M', null, 4)
			],
			roles,
			{}
		);
		expect(decks.map((d) => d.name)).toEqual(['T.16000M', 'VKBsim Gladiator', 'T.16000M 2']);
		expect(decks[0]).toMatchObject({ deviceId: 'T16000M' });
		expect(decks[0].inputs[0]).toEqual({ kind: 'hat', deviceId: 'T16000M', hat: 1, dir: 'up' });
		expect(decks[1]).toMatchObject({ deviceId: null });
		expect(decks[1].inputs).toHaveLength(12);
		expect(decks[2].inputs).toHaveLength(4);
	});

	it('is empty until a controller is detected', () => {
		expect(controllerDecks([], roles, {})).toEqual([]);
	});
});
