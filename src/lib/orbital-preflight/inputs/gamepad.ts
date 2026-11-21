import type { FileDevice, HatDirection } from '../types.ts';

/**
 * Reading HOTAS gear through the Gamepad API.
 *
 * Browsers only list a controller after one of its buttons is pressed while the page has
 * focus, so nothing shows until then. Sticks and throttles report `mapping: ''` (not the
 * "standard" gamepad layout), and buttons and axes arrive in the order the operating
 * system lists them.
 *
 * UNVERIFIED (flagged in the README and the PR):
 * - Button `n` in the browser is `Joy_{n+1}` in the file. This holds for DirectInput
 *   ordering on Windows; Linux and macOS may order buttons differently.
 * - Axis order is taken as X, Y, Z, RX, RY, RZ, U (slider), V (dial). Chrome lists HID
 *   axes by usage; Firefox's order hasn't been checked.
 * - Chrome on Windows reports a POV hat as one extra axis whose resting value is about
 *   1.29 and whose eight directions are steps of 2/7 from -1 (up) clockwise. Firefox
 *   reports hats as buttons on some platforms. Both are handled; neither is tested
 *   against real hardware here.
 * - How many buttons a browser exposes for a 32+ button stick hasn't been measured.
 */

export const AXIS_NAMES = ['X', 'Y', 'Z', 'RX', 'RY', 'RZ', 'U', 'V'] as const;

/** Vendor and product id from `Gamepad.id`, as lowercase 4-digit hex. */
export function parseGamepadId(id: string): { vendor?: string; product?: string; name: string } {
	// Chrome: "T.16000M (Vendor: 044f Product: b10a)" or "... (STANDARD GAMEPAD Vendor: 045e Product: 028e)"
	const chrome =
		/^(.*?)\s*\((?:.*?)Vendor:\s*([0-9a-f]{1,4})\s+Product:\s*([0-9a-f]{1,4})\)\s*$/i.exec(id);
	if (chrome) {
		return { name: chrome[1].trim() || id, vendor: pad(chrome[2]), product: pad(chrome[3]) };
	}
	// Firefox: "44f-b10a-T.16000M"
	const firefox = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-(.*)$/i.exec(id);
	if (firefox)
		return { name: firefox[3].trim() || id, vendor: pad(firefox[1]), product: pad(firefox[2]) };
	return { name: id };
}

function pad(hex: string): string {
	return hex.toLowerCase().padStart(4, '0');
}

/** The file device a browser controller is, by USB id, if exactly one matches. */
export function matchDevice(
	gamepadId: string,
	devices: FileDevice[],
	taken: Set<string>
): FileDevice | null {
	const { vendor, product } = parseGamepadId(gamepadId);
	if (!vendor || !product) return null;
	const matches = devices.filter(
		(d) => d.vendor === vendor && d.product === product && !taken.has(d.id)
	);
	return matches.length >= 1 ? matches[0] : null;
}

const HAT_STEPS: [number, HatDirection[]][] = [
	[-1, ['up']],
	[-5 / 7, ['up', 'right']],
	[-3 / 7, ['right']],
	[-1 / 7, ['down', 'right']],
	[1 / 7, ['down']],
	[3 / 7, ['down', 'left']],
	[5 / 7, ['left']],
	[1, ['up', 'left']]
];

/** Directions a Chrome-style hat axis is held in. Resting (about 1.29) is none. */
export function hatDirections(value: number): HatDirection[] {
	if (value > 1.1 || value < -1.1) return [];
	for (const [step, dirs] of HAT_STEPS) if (Math.abs(value - step) < 1 / 7) return dirs;
	return [];
}

/** An axis that rests above 1 is a hat, not a stick axis. */
export function looksLikeHat(value: number): boolean {
	return value > 1.1;
}

/**
 * A controller the browser maps to the W3C "standard" layout (Xbox-style pads) reports
 * buttons and axes in this order. Elite names the same controls `GamePad_FaceDown`…
 * UNVERIFIED: that Elite's names line up with the standard layout this way.
 */
export const STANDARD_BUTTONS = [
	'FaceDown',
	'FaceRight',
	'FaceLeft',
	'FaceUp',
	'LBumper',
	'RBumper',
	'LTrigger',
	'RTrigger',
	'Back',
	'Start',
	'LThumb',
	'RThumb',
	'DPadUp',
	'DPadDown',
	'DPadLeft',
	'DPadRight'
] as const;

export const STANDARD_AXES = ['LStickX', 'LStickY', 'RStickX', 'RStickY'] as const;

/** Standard-layout buttons that are analogue triggers, read as axes too. */
export const STANDARD_TRIGGERS: ReadonlySet<string> = new Set(['LTrigger', 'RTrigger']);
