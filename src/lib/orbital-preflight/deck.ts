import type { DeviceRole } from './labels.ts';
import type { BindingMap, InputId } from './types.ts';

/** The input deck under the viewport, laid out as on the boards. */

export interface DeckRow {
	indent: number;
	keys: { input: InputId; width?: number }[];
}

const key = (code: string, width?: number) => ({ input: { kind: 'key', code } as InputId, width });
const letters = (s: string) => s.split('').map((c) => key(/\d/.test(c) ? `Digit${c}` : `Key${c}`));

/** `compact` is the full editor's device map: narrower keys, no Shift. */
export function keyboardRows(compact = false): DeckRow[] {
	if (compact) {
		return [
			{ indent: 0, keys: letters('1234567890') },
			{ indent: 16, keys: letters('QWERTYUIOP') },
			{ indent: 26, keys: letters('ASDFGHJKL') },
			{ indent: 42, keys: letters('ZXCVBNM') },
			{ indent: 100, keys: [key('Space', 200)] }
		];
	}
	return [
		{ indent: 0, keys: letters('1234567890') },
		{ indent: 22, keys: letters('QWERTYUIOP') },
		{ indent: 34, keys: letters('ASDFGHJKL') },
		{ indent: 0, keys: [key('ShiftLeft', 100), ...letters('ZXCVBNM')] },
		{ indent: 140, keys: [key('Space', 250)] }
	];
}

export const MOUSE_DECK: InputId[] = [
	{ kind: 'mouse', button: 0 },
	{ kind: 'mouse', button: 2 },
	{ kind: 'mouse', button: 1 },
	{ kind: 'wheel', dir: 'up' },
	{ kind: 'wheel', dir: 'down' },
	{ kind: 'mouse', button: 3 },
	{ kind: 'mouse', button: 4 }
];

export interface DeviceDeck {
	role: DeviceRole;
	inputs: InputId[];
}

const HAT_ORDER = ['up', 'left', 'right', 'down'] as const;

/**
 * One block per device in the file: its hats, then the buttons the binds use, padded
 * with spare buttons to the boards' size (6 on a stick, 7 on a throttle).
 */
export function deviceDecks(roles: DeviceRole[], bindings: BindingMap): DeviceDeck[] {
	return roles.map((role) => {
		const hats = new Set<number>(role.kind === 'stick' ? [1] : []);
		const buttons = new Set<number>();
		for (const binding of Object.values(bindings)) {
			for (const slot of binding) {
				for (const input of [slot?.input, slot?.modifier]) {
					if (!input || !('deviceId' in input) || input.deviceId !== role.id) continue;
					if (input.kind === 'hat') hats.add(input.hat);
					if (input.kind === 'button') buttons.add(input.button);
				}
			}
		}
		const minimum = role.kind === 'stick' ? 6 : 7;
		for (let b = 1; buttons.size < minimum && b <= 32; b++) buttons.add(b);
		const inputs: InputId[] = [];
		for (const hat of [...hats].sort((a, b) => a - b)) {
			for (const dir of HAT_ORDER) inputs.push({ kind: 'hat', deviceId: role.id, hat, dir });
		}
		for (const button of [...buttons].sort((a, b) => a - b)) {
			inputs.push({ kind: 'button', deviceId: role.id, button });
		}
		return { role, inputs };
	});
}
