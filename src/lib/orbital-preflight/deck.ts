import type { BrowserPad } from './inputs/hub.svelte.ts';
import type { DeviceRole } from './labels.ts';
import { STANDARD_BUTTONS } from './inputs/gamepad.ts';
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
		// A gamepad has the same buttons whatever the file binds: show them all.
		if (role.kind === 'pad') {
			const inputs: InputId[] = STANDARD_BUTTONS.map((control) => ({
				kind: 'pad',
				deviceId: role.id,
				control
			}));
			return { role, inputs };
		}
		const hats = new Set<number>(role.kind === 'stick' ? [1] : []);
		const buttons = new Set<number>();
		for (const binding of Object.values(bindings)) {
			for (const slot of binding) {
				for (const input of [slot?.input, ...(slot?.modifiers ?? [])]) {
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

/** A controller the browser has detected, as one block on the deck. */
export interface ControllerDeck {
	/** Stable key for the block. */
	key: string;
	/** The controller's own name from `Gamepad.id`, e.g. "T.16000M". */
	name: string;
	/** The file device it's paired with, if any. */
	deviceId: string | null;
	inputs: InputId[];
}

/**
 * One block per detected controller, named after the controller. A controller paired
 * with a device in the file shows that device's hats and bound buttons; one that isn't
 * paired yet shows its first buttons, which fire nothing until it's paired. Identical
 * names get a number ("T.16000M 2").
 */
export function controllerDecks(
	pads: BrowserPad[],
	roles: DeviceRole[],
	bindings: BindingMap,
	maxUnpaired = 12
): ControllerDeck[] {
	const seen = new Map<string, number>();
	return pads.map((pad) => {
		const count = (seen.get(pad.name) ?? 0) + 1;
		seen.set(pad.name, count);
		const name = count > 1 ? `${pad.name} ${count}` : pad.name;
		const role = pad.deviceId ? roles.find((r) => r.id === pad.deviceId) : undefined;
		if (role) {
			const [deck] = deviceDecks([role], bindings);
			return { key: `pad-${pad.index}`, name, deviceId: role.id, inputs: deck.inputs };
		}
		const deviceId = `browser-${pad.index}`;
		const inputs: InputId[] = [];
		for (let b = 1; b <= Math.min(pad.buttons, maxUnpaired); b++) {
			inputs.push({ kind: 'button', deviceId, button: b });
		}
		return { key: `pad-${pad.index}`, name, deviceId: null, inputs };
	});
}
