import type { Bind, FileDevice, HatDirection, InputId, Slot } from './types.ts';

/**
 * How inputs read on screen, in the boards' style: short ("Stk TRG", "Thr B5", "LMB")
 * for slots and deck keys, long ("Stick B5", "Mouse LMB") for sentences and labels.
 */

export interface DeviceRole {
	id: string;
	/** "Stick", "Throttle", "Stick 2"… */
	long: string;
	/** "Stk", "Thr", "Stk2"… */
	short: string;
	kind: 'stick' | 'throttle';
}

/** Names each device in the file as a stick or a throttle, numbering repeats. */
export function deviceRoles(devices: FileDevice[]): DeviceRole[] {
	const isThrottle = (d: FileDevice) => /throttle|twcs|thr\b/i.test(`${d.id} ${d.name}`);
	const counts = { stick: 0, throttle: 0 };
	const totals = {
		stick: devices.filter((d) => !isThrottle(d)).length,
		throttle: devices.filter(isThrottle).length
	};
	return devices.map((d) => {
		const kind = isThrottle(d) ? 'throttle' : 'stick';
		counts[kind] += 1;
		const n = totals[kind] > 1 ? counts[kind] : 0;
		const long = `${kind === 'stick' ? 'Stick' : 'Throttle'}${n ? ` ${n}` : ''}`;
		const short = `${kind === 'stick' ? 'Stk' : 'Thr'}${n || ''}`;
		return { id: d.id, long, short, kind };
	});
}

const KEY_LABELS: Record<string, string> = {
	Space: 'Space',
	ShiftLeft: 'Shift',
	ShiftRight: 'RShift',
	ControlLeft: 'Ctrl',
	ControlRight: 'RCtrl',
	AltLeft: 'Alt',
	AltRight: 'AltGr',
	Enter: 'Enter',
	Tab: 'Tab',
	Backspace: 'Bksp',
	Escape: 'Esc',
	CapsLock: 'Caps',
	ArrowUp: '↑',
	ArrowDown: '↓',
	ArrowLeft: '←',
	ArrowRight: '→',
	Insert: 'Ins',
	Delete: 'Del',
	Home: 'Home',
	End: 'End',
	PageUp: 'PgUp',
	PageDown: 'PgDn',
	Minus: '-',
	Equal: '=',
	BracketLeft: '[',
	BracketRight: ']',
	Semicolon: ';',
	Quote: "'",
	Backquote: '`',
	Backslash: '\\',
	Comma: ',',
	Period: '.',
	Slash: '/',
	NumpadAdd: 'Num+',
	NumpadSubtract: 'Num-',
	NumpadMultiply: 'Num*',
	NumpadDivide: 'Num/',
	NumpadDecimal: 'Num.',
	NumpadEnter: 'NumEnt'
};

export function keyLabel(code: string): string {
	if (KEY_LABELS[code]) return KEY_LABELS[code];
	let m = /^Key([A-Z])$/.exec(code);
	if (m) return m[1];
	m = /^Digit(\d)$/.exec(code);
	if (m) return m[1];
	m = /^Numpad(\d)$/.exec(code);
	if (m) return `Num${m[1]}`;
	return code;
}

const MOUSE = ['LMB', 'MMB', 'RMB', 'M4', 'M5'];
const HAT: Record<HatDirection, string> = { up: '↑', down: '↓', left: '←', right: '→' };

export function inputLabel(input: InputId, roles: DeviceRole[], long = false): string {
	const role = (id: string) => roles.find((r) => r.id === id);
	const device = (id: string) => {
		const r = role(id);
		return r ? (long ? r.long : r.short) : id;
	};
	switch (input.kind) {
		case 'key':
			return keyLabel(input.code);
		case 'mouse':
			return `${long ? 'Mouse ' : ''}${MOUSE[input.button] ?? `M${input.button + 1}`}`;
		case 'wheel':
			return `${long ? 'Mouse ' : ''}Wh${input.dir === 'up' ? '↑' : '↓'}`;
		case 'button': {
			const trigger = input.button === 1 && role(input.deviceId)?.kind === 'stick';
			return `${device(input.deviceId)} ${trigger ? 'TRG' : `B${input.button}`}`;
		}
		case 'hat':
			return `${device(input.deviceId)} H${input.hat > 1 ? input.hat : ''}${HAT[input.dir]}`;
		case 'axis': {
			const half = input.half === 'pos' ? '+' : input.half === 'neg' ? '−' : '';
			return `${device(input.deviceId)} ${input.axis}${half}${long ? ' axis' : ''}`;
		}
		case 'raw':
			return long ? `${input.device} ${input.key}` : input.key;
	}
}

/** A slot as the boards print it: "—" when empty, "Shift+W" with a modifier. */
export function bindLabel(bind: Slot | Bind, roles: DeviceRole[], long = false): string {
	if (!bind) return '—';
	const main = inputLabel(bind.input, roles, long);
	const mods = (bind.modifiers ?? []).map((m) => inputLabel(m, roles, long));
	return [...mods, main].join('+');
}
