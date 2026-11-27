import type { Bind, FileDevice, HatDirection, InputId, PadControl } from '../../types.ts';

/**
 * X4 input entries ↔ our `InputId`.
 *
 * An inputmap.xml entry is one input for one control:
 *
 *   <state id="INPUT_STATE_BOOST" source="INPUT_SOURCE_KEYBOARD" code="INPUT_KEYCODE_TAB"/>
 *   <state id="INPUT_STATE_FIRE_PRIMARY_WEAPON" source="INPUT_SOURCE_JOYAXES" code="INPUT_JOYAXIS_RZ" sgn="-1"/>
 *
 * `source` is the device: the keyboard, the mouse's buttons or axes, or one of eight
 * controller slots (`INPUT_SOURCE_JOYBUTTONS`, `…_2` to `…_8`, and `JOYAXES` likewise). A
 * slot is whichever controller the pilot put there in game; the file doesn't say which.
 * Keyboard and mouse codes carry their modifier in the name (`INPUT_KEYCODE_A_SHIFT`,
 * `INPUT_MOUSEBUTTON_MIDDLE_SHIFT`); `sgn` picks one half of an axis.
 *
 * Controller buttons go by Xbox names (`INPUT_XBUTTON_A`, `…_DPAD_UP`) on every controller,
 * then by number from 12. On a slot that only uses gamepad controls they read as gamepad
 * controls; on any other as numbered buttons and a hat.
 *
 * Key names are DirectInput's (`PRIOR` is Page up, `LMENU` left Alt). Checked against the
 * 9.00 profiles the game ships and game-written inputmap.xml files. UNVERIFIED: key names
 * none of them use, which button numbers the Xbox names stand for on a stick (A is 1 up to
 * Right thumb 10, Big button 11), which wheel direction `sgn="1"` is, and which gamepad
 * trigger the Z and RZ axes are (Z left, RZ right, from the defaults' Fire on RZ).
 */

/** Keyboard keys by DirectInput name ↔ the browser's code. */
const KEYS: Record<string, string> = {
	ESCAPE: 'Escape',
	MINUS: 'Minus',
	EQUALS: 'Equal',
	BACK: 'Backspace',
	TAB: 'Tab',
	LBRACKET: 'BracketLeft',
	RBRACKET: 'BracketRight',
	RETURN: 'Enter',
	LCONTROL: 'ControlLeft',
	RCONTROL: 'ControlRight',
	SEMICOLON: 'Semicolon',
	APOSTROPHE: 'Quote',
	GRAVE: 'Backquote',
	LSHIFT: 'ShiftLeft',
	RSHIFT: 'ShiftRight',
	BACKSLASH: 'Backslash',
	OEM_102: 'IntlBackslash',
	COMMA: 'Comma',
	PERIOD: 'Period',
	SLASH: 'Slash',
	MULTIPLY: 'NumpadMultiply',
	LMENU: 'AltLeft',
	RMENU: 'AltRight',
	SPACE: 'Space',
	CAPITAL: 'CapsLock',
	NUMLOCK: 'NumLock',
	SCROLL: 'ScrollLock',
	SUBTRACT: 'NumpadSubtract',
	ADD: 'NumpadAdd',
	DECIMAL: 'NumpadDecimal',
	NUMPADENTER: 'NumpadEnter',
	DIVIDE: 'NumpadDivide',
	SYSRQ: 'PrintScreen',
	PAUSE: 'Pause',
	HOME: 'Home',
	UP: 'ArrowUp',
	PRIOR: 'PageUp',
	LEFT: 'ArrowLeft',
	RIGHT: 'ArrowRight',
	END: 'End',
	DOWN: 'ArrowDown',
	NEXT: 'PageDown',
	INSERT: 'Insert',
	DELETE: 'Delete',
	LWIN: 'MetaLeft',
	RWIN: 'MetaRight',
	APPS: 'ContextMenu'
};
const KEY_NAMES = Object.fromEntries(Object.entries(KEYS).map(([x4, code]) => [code, x4]));

export function keyNameForCode(code: string): string | null {
	if (KEY_NAMES[code]) return KEY_NAMES[code];
	const m = /^(?:Key([A-Z])|Digit(\d)|Numpad(\d)|(F\d{1,2}))$/.exec(code);
	if (!m) return null;
	if (m[1] || m[2]) return m[1] ?? m[2];
	if (m[3]) return `NUMPAD${m[3]}`;
	return Number(m[4].slice(1)) <= 15 ? m[4] : null;
}

function codeForKeyName(name: string): string | null {
	if (KEYS[name]) return KEYS[name];
	let m = /^([A-Z])$/.exec(name);
	if (m) return `Key${m[1]}`;
	m = /^(\d)$/.exec(name);
	if (m) return `Digit${m[1]}`;
	m = /^NUMPAD(\d)$/.exec(name);
	if (m) return `Numpad${m[1]}`;
	m = /^F(\d{1,2})$/.exec(name);
	if (m) return `F${m[1]}`;
	return null;
}

/** The modifiers X4 writes into a keyboard or mouse code. It has no Alt. */
const SHIFT: InputId = { kind: 'key', code: 'ShiftLeft' };
const CTRL: InputId = { kind: 'key', code: 'ControlLeft' };
const MODIFIER_CODES = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight']);

/** `A_SHIFT_CONTROL` → `A` and its modifiers. */
function splitModifiers(name: string): { base: string; modifiers: InputId[] } {
	let base = name;
	const modifiers: InputId[] = [];
	if (base.endsWith('_CONTROL')) {
		base = base.slice(0, -'_CONTROL'.length);
		modifiers.push(CTRL);
	}
	if (base.endsWith('_SHIFT')) {
		base = base.slice(0, -'_SHIFT'.length);
		modifiers.unshift(SHIFT);
	}
	return { base, modifiers };
}

function modifierSuffix(modifiers: InputId[] = []): string {
	const has = (prefix: string) =>
		modifiers.some((m) => m.kind === 'key' && m.code.startsWith(prefix));
	return `${has('Shift') ? '_SHIFT' : ''}${has('Control') ? '_CONTROL' : ''}`;
}

/** Mouse buttons by X4 name; the browser numbers them 0 left, 1 middle, 2 right, 3 back, 4 forward. */
const MOUSE: Record<string, number> = { LEFT: 0, MIDDLE: 1, RIGHT: 2, SIDE1: 3, SIDE2: 4 };
const MOUSE_NAMES = Object.fromEntries(Object.entries(MOUSE).map(([n, b]) => [b, n]));

/** Controller buttons X4 names after the Xbox pad, as gamepad controls and stick button numbers. */
const XBUTTONS: [name: string, control: PadControl, button: number][] = [
	['A', 'FaceDown', 1],
	['B', 'FaceRight', 2],
	['X', 'FaceLeft', 3],
	['Y', 'FaceUp', 4],
	['LEFT_SHOULDER', 'LBumper', 5],
	['RIGHT_SHOULDER', 'RBumper', 6],
	['BACK', 'Back', 7],
	['START', 'Start', 8],
	['LEFT_THUMB', 'LThumb', 9],
	['RIGHT_THUMB', 'RThumb', 10]
];
const DPAD: [name: string, control: PadControl, dir: HatDirection][] = [
	['DPAD_UP', 'DPadUp', 'up'],
	['DPAD_DOWN', 'DPadDown', 'down'],
	['DPAD_LEFT', 'DPadLeft', 'left'],
	['DPAD_RIGHT', 'DPadRight', 'right']
];

/** Joystick axes by X4 name ↔ the hub's names. */
const AXES: Record<string, string> = {
	X: 'X',
	Y: 'Y',
	Z: 'Z',
	RX: 'RX',
	RY: 'RY',
	RZ: 'RZ',
	SLIDER1: 'U',
	SLIDER2: 'V'
};
const AXIS_NAMES = Object.fromEntries(Object.entries(AXES).map(([x4, ours]) => [ours, x4]));

/** The gamepad's sticks and triggers by X4 axis. */
const PAD_AXES: Record<string, PadControl> = {
	X: 'LStickX',
	Y: 'LStickY',
	RX: 'RStickX',
	RY: 'RStickY',
	Z: 'LTrigger',
	RZ: 'RTrigger'
};
const PAD_AXIS_NAMES = Object.fromEntries(Object.entries(PAD_AXES).map(([x4, c]) => [c, x4]));
/** The half of each trigger axis that is the trigger pulled. */
const TRIGGER_SGN: Record<string, string> = { LTrigger: '1', RTrigger: '-1' };

/** Controller slot 1–8 from a source, or null for the keyboard and mouse. */
export function slotOf(source: string): number | null {
	const m = /^INPUT_SOURCE_JOY(?:BUTTONS|AXES)(?:_(\d))?$/.exec(source);
	return m ? Number(m[1] ?? 1) : null;
}

/** Our device id for a controller slot. */
export const slotDevice = (slot: number) => `joy${slot}`;

const deviceSlot = (deviceId: string) => Number(/^joy(\d)$/.exec(deviceId)?.[1] ?? 0) || null;

const source = (kind: 'BUTTONS' | 'AXES', slot: number) =>
	`INPUT_SOURCE_JOY${kind}${slot > 1 ? `_${slot}` : ''}`;

/** One entry as the file has it. `sgn` is '' when the entry has none. */
export interface Entry {
	source: string;
	code: string;
	sgn: string;
}

/** Whether an entry is a controller input a gamepad has, so its slot can read as one. */
export function isPadShaped({ source, code }: Entry): boolean {
	if (slotOf(source) === null) return true;
	const name = code.replace(/^INPUT_(XBUTTON|JOYAXIS)_/, '');
	if (code.startsWith('INPUT_XBUTTON_')) {
		return XBUTTONS.some(([n]) => n === name) || DPAD.some(([n]) => n === name);
	}
	return code.startsWith('INPUT_JOYAXIS_') && name in PAD_AXES;
}

/** Radial menu slots and anything else that isn't a key, button or axis a pilot presses. */
export function isPhysical({ source }: Entry): boolean {
	return !source.startsWith('INPUT_SOURCE_COMPASSMENU');
}

const raw = ({ source, code, sgn }: Entry): Bind => ({
	input: { kind: 'raw', device: source, key: sgn ? `${code} ${sgn}` : code }
});

/** An entry → a bind. `gamepads` are the controller slots that read as gamepads. */
export function decodeEntry(entry: Entry, gamepads: ReadonlySet<number>): Bind {
	const { source: src, code, sgn } = entry;
	const half = sgn === '1' ? 'pos' : sgn === '-1' ? 'neg' : undefined;
	const withMods = (input: InputId, modifiers: InputId[]): Bind =>
		modifiers.length ? { input, modifiers } : { input };

	if (src === 'INPUT_SOURCE_KEYBOARD' && code.startsWith('INPUT_KEYCODE_')) {
		const name = code.slice('INPUT_KEYCODE_'.length);
		// A key whose own name ends in a modifier's (none do today) reads as itself.
		const whole = codeForKeyName(name);
		const { base, modifiers } = splitModifiers(name);
		const key = codeForKeyName(base);
		if (key && modifiers.length) return withMods({ kind: 'key', code: key }, modifiers);
		if (whole) return { input: { kind: 'key', code: whole } };
		return raw(entry);
	}
	if (src === 'INPUT_SOURCE_MOUSEBUTTONS' && code.startsWith('INPUT_MOUSEBUTTON_')) {
		const { base, modifiers } = splitModifiers(code.slice('INPUT_MOUSEBUTTON_'.length));
		if (base in MOUSE) return withMods({ kind: 'mouse', button: MOUSE[base] }, modifiers);
		return raw(entry);
	}
	if (src === 'INPUT_SOURCE_MOUSEAXES') {
		const m = /^INPUT_MOUSEAXIS_Z(_SHIFT)?$/.exec(code);
		if (m && half) {
			return withMods({ kind: 'wheel', dir: half === 'pos' ? 'up' : 'down' }, m[1] ? [SHIFT] : []);
		}
		return raw(entry);
	}
	const slot = slotOf(src);
	if (slot === null) return raw(entry);
	const deviceId = slotDevice(slot);
	const pad = gamepads.has(slot);
	if (code.startsWith('INPUT_XBUTTON_')) {
		const name = code.slice('INPUT_XBUTTON_'.length);
		const x = XBUTTONS.find(([n]) => n === name);
		if (x) {
			return {
				input: pad
					? { kind: 'pad', deviceId, control: x[1] }
					: { kind: 'button', deviceId, button: x[2] }
			};
		}
		const d = DPAD.find(([n]) => n === name);
		if (d) {
			return {
				input: pad
					? { kind: 'pad', deviceId, control: d[1] }
					: { kind: 'hat', deviceId, hat: 1, dir: d[2] }
			};
		}
		if (name === 'BIGBUTTON' && !pad) return { input: { kind: 'button', deviceId, button: 11 } };
		if (/^\d+$/.test(name) && !pad) return { input: { kind: 'button', deviceId, button: +name } };
		return raw(entry);
	}
	if (code.startsWith('INPUT_JOYAXIS_')) {
		const name = code.slice('INPUT_JOYAXIS_'.length);
		if (pad && PAD_AXES[name]) {
			const control = PAD_AXES[name];
			// A trigger is one half of its axis, so it reads as the trigger whichever way the
			// file writes it; the writer picks the half from the control (`encodeBind`'s axis).
			if (control in TRIGGER_SGN) return { input: { kind: 'pad', deviceId, control } };
			return { input: { kind: 'pad', deviceId, control, ...(half && { half }) } };
		}
		if (!pad && AXES[name]) {
			return { input: { kind: 'axis', deviceId, axis: AXES[name], ...(half && { half }) } };
		}
	}
	return raw(entry);
}

/**
 * A bind → the entry the file writes for it, or null when X4 has no code for it. `axis`
 * says the control is a range: a gamepad trigger then binds as its whole axis, and as the
 * pulled half otherwise.
 */
export function encodeBind(bind: Bind, axis = false): Entry | null {
	const { input, modifiers } = bind;
	switch (input.kind) {
		case 'key': {
			const name = keyNameForCode(input.code);
			if (!name) return null;
			return {
				source: 'INPUT_SOURCE_KEYBOARD',
				code: `INPUT_KEYCODE_${name}${modifierSuffix(modifiers)}`,
				sgn: ''
			};
		}
		case 'mouse': {
			const name = MOUSE_NAMES[input.button];
			if (!name) return null;
			return {
				source: 'INPUT_SOURCE_MOUSEBUTTONS',
				code: `INPUT_MOUSEBUTTON_${name}${modifierSuffix(modifiers)}`,
				sgn: ''
			};
		}
		case 'wheel': {
			const shift = modifierSuffix(modifiers).includes('SHIFT') ? '_SHIFT' : '';
			return {
				source: 'INPUT_SOURCE_MOUSEAXES',
				code: `INPUT_MOUSEAXIS_Z${shift}`,
				sgn: input.dir === 'up' ? '1' : '-1'
			};
		}
		case 'button':
		case 'hat':
		case 'axis':
		case 'pad': {
			const slot = deviceSlot(input.deviceId);
			if (!slot) return null;
			if (input.kind === 'button') {
				const x = XBUTTONS.find(([, , b]) => b === input.button);
				const name = x
					? x[0]
					: input.button === 11
						? 'BIGBUTTON'
						: input.button <= 32
							? String(input.button)
							: null;
				return name
					? { source: source('BUTTONS', slot), code: `INPUT_XBUTTON_${name}`, sgn: '' }
					: null;
			}
			if (input.kind === 'hat') {
				const d = DPAD.find(([, , dir]) => dir === input.dir);
				return input.hat === 1 && d
					? { source: source('BUTTONS', slot), code: `INPUT_XBUTTON_${d[0]}`, sgn: '' }
					: null;
			}
			if (input.kind === 'axis') {
				const name = AXIS_NAMES[input.axis];
				if (!name) return null;
				const sgn = input.half === 'pos' ? '1' : input.half === 'neg' ? '-1' : '';
				return { source: source('AXES', slot), code: `INPUT_JOYAXIS_${name}`, sgn };
			}
			const x = XBUTTONS.find(([, c]) => c === input.control);
			if (x) return { source: source('BUTTONS', slot), code: `INPUT_XBUTTON_${x[0]}`, sgn: '' };
			const d = DPAD.find(([, c]) => c === input.control);
			if (d) return { source: source('BUTTONS', slot), code: `INPUT_XBUTTON_${d[0]}`, sgn: '' };
			const padAxis = PAD_AXIS_NAMES[input.control];
			if (!padAxis) return null;
			const sgn =
				input.control in TRIGGER_SGN
					? axis
						? ''
						: TRIGGER_SGN[input.control]
					: input.half === 'pos'
						? '1'
						: input.half === 'neg'
							? '-1'
							: '';
			return { source: source('AXES', slot), code: `INPUT_JOYAXIS_${padAxis}`, sgn };
		}
		case 'raw': {
			const [code, sgn = ''] = input.key.split(' ');
			return { source: input.device, code, sgn };
		}
	}
}

/** Why an inputmap.xml can't hold `input`, or null when it can. */
export function cannotBind(input: InputId): string | null {
	if (input.kind === 'key' && !keyNameForCode(input.code)) return 'X4 has no name for that key.';
	if (input.kind === 'mouse' && !(input.button in MOUSE_NAMES)) {
		return 'X4 reads five mouse buttons.';
	}
	if (input.kind === 'button' && input.button > 32) return 'X4 reads 32 buttons per controller.';
	if (input.kind === 'hat' && input.hat > 1) return 'X4 reads one hat per controller.';
	if (input.kind === 'axis' && !AXIS_NAMES[input.axis]) {
		return 'X4 reads eight axes per controller.';
	}
	return null;
}

/**
 * Why X4 can't hold `bind` in a slot, or null. Keyboard keys and mouse buttons take Shift
 * and Ctrl, the wheel Shift; controllers take no modifier in the file (X4 sets its two
 * controller modifiers in game).
 */
export function refuse(bind: Bind): string | null {
	const mods = bind.modifiers ?? [];
	if (!mods.length) return null;
	const { input } = bind;
	if (input.kind === 'key' || input.kind === 'mouse') {
		const ok = mods.every((m) => m.kind === 'key' && MODIFIER_CODES.has(m.code));
		return ok ? null : 'X4 takes Shift or Ctrl as a modifier.';
	}
	if (input.kind === 'wheel') {
		const ok = mods.every((m) => m.kind === 'key' && m.code.startsWith('Shift'));
		return ok ? null : 'X4 takes Shift as a modifier on the wheel.';
	}
	return 'X4 sets controller modifiers in game, not in inputmap.xml.';
}

/**
 * The device id for a controller the file doesn't use yet: `joy:` with its USB ids. The
 * writer puts it in the next free slot. Which physical controller X4 puts in that slot is
 * the game's to decide (Controls → Joysticks), so the pilot may need to set it there.
 */
export function newDeviceId(vendor: string, product: string): string {
	return `joy:${vendor}${product}`;
}

/** A controller slot as the file uses it. */
export function describeDevice(slot: number, gamepad: boolean): FileDevice {
	const id = slotDevice(slot);
	return gamepad ? { id, name: 'Gamepad', gamepad: true } : { id, name: `Joystick ${slot}` };
}
