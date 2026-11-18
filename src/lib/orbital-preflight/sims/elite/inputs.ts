import type { FileDevice, HatDirection, InputId } from '../../types.ts';

/**
 * Elite Dangerous Device/Key pairs ↔ our `InputId`.
 *
 * UNVERIFIED: the key names, device names and USB ids below are from memory of real
 * .binds files and have not been checked against files exported by the game. Anything
 * this doesn't recognise becomes a `raw` input, which round-trips untouched and still
 * shows up in the panel under its file name.
 */

export const NO_DEVICE = '{NoDevice}';

/** Browser `KeyboardEvent.code` → ED key name, for the keys whose names differ by more than a prefix. */
const KEY_NAMES: Record<string, string> = {
	Space: 'Key_Space',
	Enter: 'Key_Enter',
	Tab: 'Key_Tab',
	Backspace: 'Key_Backspace',
	Escape: 'Key_Escape',
	ShiftLeft: 'Key_LeftShift',
	ShiftRight: 'Key_RightShift',
	ControlLeft: 'Key_LeftControl',
	ControlRight: 'Key_RightControl',
	AltLeft: 'Key_LeftAlt',
	AltRight: 'Key_RightAlt',
	CapsLock: 'Key_CapsLock',
	ArrowUp: 'Key_UpArrow',
	ArrowDown: 'Key_DownArrow',
	ArrowLeft: 'Key_LeftArrow',
	ArrowRight: 'Key_RightArrow',
	Insert: 'Key_Insert',
	Delete: 'Key_Delete',
	Home: 'Key_Home',
	End: 'Key_End',
	PageUp: 'Key_PageUp',
	PageDown: 'Key_PageDown',
	Minus: 'Key_Minus',
	Equal: 'Key_Equals',
	BracketLeft: 'Key_LeftBracket',
	BracketRight: 'Key_RightBracket',
	Semicolon: 'Key_SemiColon',
	Quote: 'Key_Apostrophe',
	Backquote: 'Key_Grave',
	Backslash: 'Key_BackSlash',
	Comma: 'Key_Comma',
	Period: 'Key_Period',
	Slash: 'Key_Slash',
	NumpadAdd: 'Key_Numpad_Add',
	NumpadSubtract: 'Key_Numpad_Subtract',
	NumpadMultiply: 'Key_Numpad_Multiply',
	NumpadDivide: 'Key_Numpad_Divide',
	NumpadDecimal: 'Key_Numpad_Decimal',
	NumpadEnter: 'Key_NumpadEnter'
};

const CODES: Record<string, string> = Object.fromEntries(
	Object.entries(KEY_NAMES).map(([code, name]) => [name, code])
);

export function keyNameForCode(code: string): string | null {
	if (KEY_NAMES[code]) return KEY_NAMES[code];
	let m = /^Key([A-Z])$/.exec(code);
	if (m) return `Key_${m[1]}`;
	m = /^Digit(\d)$/.exec(code);
	if (m) return `Key_${m[1]}`;
	m = /^Numpad(\d)$/.exec(code);
	if (m) return `Key_Numpad_${m[1]}`;
	m = /^F(\d{1,2})$/.exec(code);
	if (m) return `Key_F${m[1]}`;
	return null;
}

export function codeForKeyName(name: string): string | null {
	if (CODES[name]) return CODES[name];
	let m = /^Key_([A-Z])$/.exec(name);
	if (m) return `Key${m[1]}`;
	m = /^Key_(\d)$/.exec(name);
	if (m) return `Digit${m[1]}`;
	m = /^Key_Numpad_(\d)$/.exec(name);
	if (m) return `Numpad${m[1]}`;
	m = /^Key_F(\d{1,2})$/.exec(name);
	if (m) return `F${m[1]}`;
	return null;
}

/**
 * ED numbers mouse buttons the DirectInput way (1 left, 2 right, 3 middle); the browser's
 * `MouseEvent.button` is 0 left, 1 middle, 2 right. UNVERIFIED against a real file.
 */
const DI_TO_BROWSER = [0, 2, 1, 3, 4];

const HATS: Record<string, HatDirection> = { Up: 'up', Down: 'down', Left: 'left', Right: 'right' };

/** One Device/Key pair → an input, or null for an empty slot. */
export function decodeInput(device: string, key: string): InputId | null {
	if (device === NO_DEVICE || (!device && !key)) return null;

	if (device === 'Keyboard') {
		const code = codeForKeyName(key);
		return code ? { kind: 'key', code } : { kind: 'raw', device, key };
	}

	if (device === 'Mouse') {
		let m = /^Mouse_(\d)$/.exec(key);
		if (m && DI_TO_BROWSER[Number(m[1]) - 1] !== undefined) {
			return { kind: 'mouse', button: DI_TO_BROWSER[Number(m[1]) - 1] };
		}
		m = /^(Pos|Neg)_Mouse_ZAxis$/.exec(key);
		if (m) return { kind: 'wheel', dir: m[1] === 'Pos' ? 'up' : 'down' };
		return { kind: 'raw', device, key };
	}

	let m = /^Joy_(\d+)$/.exec(key);
	if (m) return { kind: 'button', deviceId: device, button: Number(m[1]) };
	m = /^Joy_POV(\d)(Up|Down|Left|Right)$/.exec(key);
	if (m) return { kind: 'hat', deviceId: device, hat: Number(m[1]), dir: HATS[m[2]] };
	m = /^(?:(Pos|Neg)_)?Joy_(\w+)Axis$/.exec(key);
	if (m) {
		const half = m[1] === 'Pos' ? 'pos' : m[1] === 'Neg' ? 'neg' : undefined;
		return { kind: 'axis', deviceId: device, axis: m[2], ...(half && { half }) };
	}
	return { kind: 'raw', device, key };
}

/** An input → the Device/Key pair the file would hold. */
export function encodeInput(input: InputId | null): { device: string; key: string } {
	if (!input) return { device: NO_DEVICE, key: '' };
	switch (input.kind) {
		case 'key':
			return { device: 'Keyboard', key: keyNameForCode(input.code) ?? input.code };
		case 'mouse':
			return { device: 'Mouse', key: `Mouse_${DI_TO_BROWSER.indexOf(input.button) + 1}` };
		case 'wheel':
			return { device: 'Mouse', key: `${input.dir === 'up' ? 'Pos' : 'Neg'}_Mouse_ZAxis` };
		case 'button':
			return { device: input.deviceId, key: `Joy_${input.button}` };
		case 'hat': {
			const dir = input.dir[0].toUpperCase() + input.dir.slice(1);
			return { device: input.deviceId, key: `Joy_POV${input.hat}${dir}` };
		}
		case 'axis': {
			const prefix = input.half ? `${input.half === 'pos' ? 'Pos' : 'Neg'}_` : '';
			return { device: input.deviceId, key: `${prefix}Joy_${input.axis}Axis` };
		}
		case 'raw':
			return { device: input.device, key: input.key };
	}
}

/** Devices ED names by model. Ids are lowercase hex. UNVERIFIED. */
const KNOWN_DEVICES: Record<string, { name: string; vendor: string; product: string }> = {
	T16000M: { name: 'Thrustmaster T.16000M', vendor: '044f', product: 'b10a' },
	T16000MFCS: { name: 'Thrustmaster T.16000M FCS', vendor: '044f', product: 'b10a' },
	T16000MTHROTTLE: { name: 'Thrustmaster TWCS Throttle', vendor: '044f', product: 'b687' },
	ThrustMasterWarthogJoystick: {
		name: 'Thrustmaster Warthog stick',
		vendor: '044f',
		product: '0402'
	},
	ThrustMasterWarthogThrottle: {
		name: 'Thrustmaster Warthog throttle',
		vendor: '044f',
		product: '0404'
	},
	ThrustMasterHOTAS4: { name: 'Thrustmaster T.Flight HOTAS 4', vendor: '044f', product: 'b67c' },
	SaitekX56Joystick: { name: 'Logitech X56 stick', vendor: '0738', product: '2221' },
	SaitekX56Throttle: { name: 'Logitech X56 throttle', vendor: '0738', product: 'a221' },
	SaitekX52: { name: 'Saitek X52', vendor: '06a3', product: '075c' },
	SaitekX52Pro: { name: 'Saitek X52 Pro', vendor: '06a3', product: '0762' }
};

/** Why an Elite file can't hold `input`, or null when it can. */
export function cannotBind(input: InputId): string | null {
	if (input.kind === 'key' && !keyNameForCode(input.code)) {
		return 'Elite Dangerous has no name for that key.';
	}
	if (input.kind === 'mouse' && !DI_TO_BROWSER.includes(input.button)) {
		return 'Elite Dangerous reads five mouse buttons.';
	}
	return null;
}

/**
 * The device name Elite writes for a controller: its model name where the game has one,
 * otherwise vendor and product id in upper-case hex (`231D0200`). UNVERIFIED.
 */
export function newDeviceId(vendor: string, product: string): string {
	const known = Object.entries(KNOWN_DEVICES).find(
		([, d]) => d.vendor === vendor && d.product === product
	);
	return known ? known[0] : `${vendor}${product}`.toUpperCase();
}

/** Keyboard, mouse and gamepad aren't devices to pair. */
export function isPairableDevice(id: string): boolean {
	return !['Keyboard', 'Mouse', 'GamePad', NO_DEVICE, ''].includes(id);
}

export function describeDevice(id: string): FileDevice {
	const known = KNOWN_DEVICES[id];
	if (known) return { id, ...known };
	// Devices ED doesn't know by name are written as vendor id + product id, e.g. 231D0200.
	const hex = /^([0-9A-F]{4})([0-9A-F]{4})$/i.exec(id);
	if (hex) {
		const vendor = hex[1].toLowerCase();
		const product = hex[2].toLowerCase();
		return {
			id,
			name: VENDORS[vendor] ? `${VENDORS[vendor]} ${product}` : `Device ${id}`,
			vendor,
			product
		};
	}
	return { id, name: id };
}

const VENDORS: Record<string, string> = {
	'231d': 'VKB',
	'3344': 'Virpil',
	'044f': 'Thrustmaster',
	'0738': 'Logitech',
	'06a3': 'Saitek',
	'046d': 'Logitech'
};
