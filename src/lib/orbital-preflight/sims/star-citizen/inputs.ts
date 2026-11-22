import type { Bind, FileDevice, HatDirection, InputId, PadControl } from '../../types.ts';

/**
 * Star Citizen input strings ↔ our `InputId`.
 *
 * A layout file writes one string per device: `kb1_lalt+n`, `kb1_mouse1`, `js2_button5`,
 * `js1_rotz`, `gp1_shoulderl+a`, and `js1_ ` (a space) for "nothing on this device". Mouse
 * buttons and the wheel are written on the keyboard device (`kb1_mouse1`), as the game's
 * own exports do; `mo1_` is read too. defaultProfile.xml spells the same inputs without
 * the device prefix, one attribute per device (`keyboard="lalt+n"`, `joystick="button3"`).
 *
 * Checked against layouts exported by the game (4.3 and later) and defaultProfile.xml
 * from 4.10.2. UNVERIFIED: the key names no file in hand uses (F13+, Print, Scroll lock,
 * the numpad Enter), the gamepad stick directions, and which browser mouse button the
 * game calls mouse4 and mouse5.
 */

/** A device as a layout names it: `kb1`, `mo1`, `js2`, `gp1`. */
export type DeviceKey = string;

/** Keyboard keys whose Star Citizen name isn't the browser's code lowercased. */
const KEY_NAMES: Record<string, string> = {
	Space: 'space',
	Enter: 'enter',
	Tab: 'tab',
	Backspace: 'backspace',
	Escape: 'escape',
	ShiftLeft: 'lshift',
	ShiftRight: 'rshift',
	ControlLeft: 'lctrl',
	ControlRight: 'rctrl',
	AltLeft: 'lalt',
	AltRight: 'ralt',
	CapsLock: 'capslock',
	ArrowUp: 'up',
	ArrowDown: 'down',
	ArrowLeft: 'left',
	ArrowRight: 'right',
	Insert: 'insert',
	Delete: 'delete',
	Home: 'home',
	End: 'end',
	PageUp: 'pgup',
	PageDown: 'pgdn',
	Minus: 'minus',
	Equal: 'equals',
	BracketLeft: 'lbracket',
	BracketRight: 'rbracket',
	Semicolon: 'semicolon',
	Quote: 'apostrophe',
	Backquote: 'grave',
	Backslash: 'backslash',
	Comma: 'comma',
	Period: 'period',
	Slash: 'slash',
	NumpadAdd: 'np_add',
	NumpadSubtract: 'np_subtract',
	NumpadMultiply: 'np_multiply',
	NumpadDivide: 'np_divide',
	NumpadDecimal: 'np_period',
	NumpadEnter: 'np_enter',
	NumLock: 'numlock',
	ScrollLock: 'scrolllock',
	Pause: 'pause',
	PrintScreen: 'print'
};

const CODES: Record<string, string> = Object.fromEntries(
	Object.entries(KEY_NAMES).map(([code, name]) => [name, code])
);

/** The keys Star Citizen takes as modifiers on a keyboard or mouse bind. */
const MODIFIER_KEYS = new Set(['lshift', 'rshift', 'lctrl', 'rctrl', 'lalt', 'ralt']);
/** And on a gamepad: the left shoulder is the default layer button. */
const PAD_MODIFIERS = new Set(['shoulderl', 'shoulderr']);

export function keyNameForCode(code: string): string | null {
	if (KEY_NAMES[code]) return KEY_NAMES[code];
	let m = /^Key([A-Z])$/.exec(code);
	if (m) return m[1].toLowerCase();
	m = /^Digit(\d)$/.exec(code);
	if (m) return m[1];
	m = /^Numpad(\d)$/.exec(code);
	if (m) return `np_${m[1]}`;
	m = /^F(\d{1,2})$/.exec(code);
	if (m) return `f${m[1]}`;
	return null;
}

export function codeForKeyName(name: string): string | null {
	const key = name.toLowerCase();
	if (CODES[key]) return CODES[key];
	let m = /^([a-z])$/.exec(key);
	if (m) return `Key${m[1].toUpperCase()}`;
	m = /^(\d)$/.exec(key);
	if (m) return `Digit${m[1]}`;
	m = /^np_(\d)$/.exec(key);
	if (m) return `Numpad${m[1]}`;
	m = /^f(\d{1,2})$/.exec(key);
	if (m) return `F${m[1]}`;
	return null;
}

/** `mouse1` left, `mouse2` right, `mouse3` middle; the browser numbers them 0 left, 1 middle, 2 right. */
const MOUSE_TO_BROWSER: Record<string, number> = {
	mouse1: 0,
	mouse2: 2,
	mouse3: 1,
	mouse4: 3,
	mouse5: 4
};
const BROWSER_TO_MOUSE = Object.fromEntries(
	Object.entries(MOUSE_TO_BROWSER).map(([name, button]) => [button, name])
);

/** Joystick axes by Star Citizen name ↔ the hub's axis names. */
const AXES: Record<string, string> = {
	x: 'X',
	y: 'Y',
	z: 'Z',
	rotx: 'RX',
	roty: 'RY',
	rotz: 'RZ',
	slider1: 'U',
	slider2: 'V'
};
const AXIS_NAMES = Object.fromEntries(Object.entries(AXES).map(([sc, ours]) => [ours, sc]));

/** Gamepad controls by Star Citizen name ↔ the names the hub and labels use. */
const PAD: Record<string, PadControl> = {
	a: 'FaceDown',
	b: 'FaceRight',
	x: 'FaceLeft',
	y: 'FaceUp',
	shoulderl: 'LBumper',
	shoulderr: 'RBumper',
	triggerl_btn: 'LTrigger',
	triggerr_btn: 'RTrigger',
	thumbl: 'LThumb',
	thumbr: 'RThumb',
	back: 'Back',
	start: 'Start',
	dpad_up: 'DPadUp',
	dpad_down: 'DPadDown',
	dpad_left: 'DPadLeft',
	dpad_right: 'DPadRight',
	thumblx: 'LStickX',
	thumbly: 'LStickY',
	thumbrx: 'RStickX',
	thumbry: 'RStickY'
};
const PAD_NAMES = Object.fromEntries(Object.entries(PAD).map(([sc, ours]) => [ours, sc]));

/** Stick directions, as the UI's own binds use them. Up is the negative half. UNVERIFIED. */
const PAD_HALVES: Record<string, { control: PadControl; half: 'pos' | 'neg' }> = {
	thumbl_up: { control: 'LStickY', half: 'neg' },
	thumbl_down: { control: 'LStickY', half: 'pos' },
	thumbl_left: { control: 'LStickX', half: 'neg' },
	thumbl_right: { control: 'LStickX', half: 'pos' },
	thumbr_up: { control: 'RStickY', half: 'neg' },
	thumbr_down: { control: 'RStickY', half: 'pos' },
	thumbr_left: { control: 'RStickX', half: 'neg' },
	thumbr_right: { control: 'RStickX', half: 'pos' }
};

const HATS: Record<string, HatDirection> = { up: 'up', down: 'down', left: 'left', right: 'right' };

/** One token on one device → an input. Anything unknown is kept as `raw`. */
function decodeToken(device: DeviceKey, token: string): InputId {
	const t = token.toLowerCase();
	const kind = device.slice(0, 2);
	if (kind === 'kb' || kind === 'mo') {
		if (t in MOUSE_TO_BROWSER) return { kind: 'mouse', button: MOUSE_TO_BROWSER[t] };
		if (t === 'mwheel_up' || t === 'mwheel_down') {
			return { kind: 'wheel', dir: t === 'mwheel_up' ? 'up' : 'down' };
		}
		const code = kind === 'kb' ? codeForKeyName(t) : null;
		if (code) return { kind: 'key', code };
		return { kind: 'raw', device, key: token };
	}
	if (kind === 'js') {
		let m = /^button(\d+)$/.exec(t);
		if (m) return { kind: 'button', deviceId: device, button: Number(m[1]) };
		m = /^hat(\d)_(up|down|left|right)$/.exec(t);
		if (m) return { kind: 'hat', deviceId: device, hat: Number(m[1]), dir: HATS[m[2]] };
		if (AXES[t]) return { kind: 'axis', deviceId: device, axis: AXES[t] };
		return { kind: 'raw', device, key: token };
	}
	if (kind === 'gp') {
		if (PAD[t]) return { kind: 'pad', deviceId: device, control: PAD[t] };
		if (PAD_HALVES[t]) return { kind: 'pad', deviceId: device, ...PAD_HALVES[t] };
	}
	return { kind: 'raw', device, key: token };
}

function isModifierToken(device: DeviceKey, token: string): boolean {
	const t = token.toLowerCase();
	return device.startsWith('gp') ? PAD_MODIFIERS.has(t) : MODIFIER_KEYS.has(t);
}

/**
 * The text after a device prefix (`lalt+n`, `f6+lalt`, `shoulderl+a`) → a bind, or null
 * for nothing (`' '`, `''`). Modifiers may come before or after the key, as they do in
 * defaultProfile.xml; when every part could be a modifier (`shoulderl+shoulderr`), the
 * last is the key.
 */
export function decodeBind(device: DeviceKey, text: string): Bind | null {
	const tokens = text
		.trim()
		.split('+')
		.map((t) => t.trim())
		.filter(Boolean);
	if (!tokens.length) return null;
	let main = tokens.findIndex((t) => !isModifierToken(device, t));
	if (main < 0) main = tokens.length - 1;
	const input = decodeToken(device, tokens[main]);
	const modifiers = tokens.filter((_, i) => i !== main).map((t) => decodeToken(device, t));
	return modifiers.length ? { input, modifiers } : { input };
}

/** `kb1_lalt+n` → its device and bind. Null for anything that isn't `<device>_<input>`. */
export function decodeRebind(value: string): { device: DeviceKey; bind: Bind | null } | null {
	const m = /^([a-z]{2}\d+)_(.*)$/i.exec(value);
	if (!m) return null;
	const device = m[1].toLowerCase();
	return { device, bind: decodeBind(device, m[2]) };
}

function encodeToken(input: InputId): string {
	switch (input.kind) {
		case 'key':
			return keyNameForCode(input.code) ?? input.code;
		case 'mouse':
			return BROWSER_TO_MOUSE[input.button] ?? `mouse${input.button + 1}`;
		case 'wheel':
			return input.dir === 'up' ? 'mwheel_up' : 'mwheel_down';
		case 'button':
			return `button${input.button}`;
		case 'hat':
			return `hat${input.hat}_${input.dir}`;
		case 'axis':
			return AXIS_NAMES[input.axis] ?? input.axis.toLowerCase();
		case 'pad': {
			if (input.half) {
				const entry = Object.entries(PAD_HALVES).find(
					([, h]) => h.control === input.control && h.half === input.half
				);
				if (entry) return entry[0];
			}
			return PAD_NAMES[input.control] ?? input.control.toLowerCase();
		}
		case 'raw':
			return input.key;
	}
}

/** A bind → the text after the device prefix: `lalt+n`. Modifiers first, as the game writes them. */
export function encodeBind(bind: Bind): string {
	return [...(bind.modifiers ?? []), bind.input].map(encodeToken).join('+');
}

/**
 * The kind of device an input can go on: `kb` (keys, mouse buttons, the wheel), `mo`
 * (mouse axes, kept raw), `js` and `gp` with their device id.
 */
export function deviceKind(input: InputId): 'kb' | 'mo' | 'js' | 'gp' | null {
	switch (input.kind) {
		case 'key':
		case 'mouse':
		case 'wheel':
			return 'kb';
		case 'button':
		case 'hat':
		case 'axis':
			return 'js';
		case 'pad':
			return 'gp';
		case 'raw': {
			const kind = input.device.slice(0, 2);
			return kind === 'kb' || kind === 'mo' || kind === 'js' || kind === 'gp' ? kind : null;
		}
	}
}

/** Why a Star Citizen layout can't hold `input`, or null when it can. */
export function cannotBind(input: InputId): string | null {
	if (input.kind === 'key' && !keyNameForCode(input.code)) {
		return 'Star Citizen has no name for that key.';
	}
	if (input.kind === 'mouse' && !(input.button in BROWSER_TO_MOUSE)) {
		return 'Star Citizen reads five mouse buttons.';
	}
	if (input.kind === 'axis' && input.half) {
		return 'Star Citizen binds a whole axis, not one half of it.';
	}
	if (input.kind === 'axis' && !AXIS_NAMES[input.axis]) {
		return 'Star Citizen reads eight axes per controller.';
	}
	return null;
}

/**
 * Why a layout can't hold `bind` next to `other` (the action's other slot), or null.
 * Star Citizen keeps one bind per device per action, and only takes Shift, Ctrl and Alt
 * (or a gamepad shoulder) as modifiers.
 */
export function refuse(bind: Bind, other: Bind | null): string | null {
	const kind = deviceKind(bind.input);
	for (const m of bind.modifiers ?? []) {
		const ok =
			kind === 'gp'
				? m.kind === 'pad' && (m.control === 'LBumper' || m.control === 'RBumper')
				: kind === 'kb' && m.kind === 'key' && MODIFIER_KEYS.has(keyNameForCode(m.code) ?? '');
		if (!ok) {
			return kind === 'gp'
				? 'Star Citizen takes a shoulder button as a gamepad modifier.'
				: kind === 'kb'
					? 'Star Citizen takes Shift, Ctrl or Alt as a modifier.'
					: 'Star Citizen sets joystick modifiers in game, not in the layout.';
		}
	}
	if (other && sameDevice(bind.input, other.input)) {
		return 'Star Citizen keeps one bind per device for each action, and the other slot already has this one.';
	}
	return null;
}

function sameDevice(a: InputId, b: InputId): boolean {
	const ka = deviceKind(a);
	if (!ka || ka !== deviceKind(b)) return false;
	if (ka === 'kb' || ka === 'mo') return true;
	const id = (i: InputId) => ('deviceId' in i ? i.deviceId : i.kind === 'raw' ? i.device : '');
	return id(a) === id(b);
}

/**
 * The device id for a controller the layout doesn't name yet: `js:` with its USB ids. The
 * writer gives it the next free joystick instance and an `<options>` line.
 */
export function newDeviceId(vendor: string, product: string): string {
	return `js:${vendor}${product}`;
}

/** `{0200231D-0000-0000-0000-504944564944}` → vendor 231d, product 0200 (DirectInput's PIDVID). */
export function usbIds(productAttribute: string): { vendor: string; product: string } | null {
	const m = /\{([0-9A-F]{4})([0-9A-F]{4})-0000-0000-0000-504944564944\}/i.exec(productAttribute);
	return m ? { product: m[1].toLowerCase(), vendor: m[2].toLowerCase() } : null;
}

/** The device line a layout writes for a controller: name, two spaces, then the PIDVID guid. */
export function productAttribute(name: string, vendor: string, product: string): string {
	return `${name}  {${product.toUpperCase()}${vendor.toUpperCase()}-0000-0000-0000-504944564944}`;
}

/** A device a layout names in its `<options>`, or one the defaults bind to. */
export function describeDevice(id: DeviceKey, product?: string): FileDevice {
	const n = /\d+$/.exec(id)?.[0] ?? '1';
	if (id.startsWith('gp')) return { id, name: 'Gamepad', gamepad: true };
	const ids = product ? usbIds(product) : null;
	const name = product?.replace(/\s*\{[^}]*\}\s*$/, '').trim();
	return {
		id,
		name: name || `Joystick ${n}`,
		...(ids && { vendor: ids.vendor, product: ids.product })
	};
}
