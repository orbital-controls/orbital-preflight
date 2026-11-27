import { axisValueKey } from '../bindings.ts';
import type { Action, AnalogRole, BindingMap } from '../types.ts';

/** Bound stick axes as the 3D scene reads them, with whether each one is bound. */
export interface Analog {
	/** Ship: -1..1. */
	pitch: number;
	roll: number;
	yaw: number;
	/** SRV steering, -1 (left) .. 1 (right). */
	steer: number;
	/** SRV drive speed, 0 (stopped) .. 1 (full ahead). */
	drive: number;
	/** On foot, -1..1: strafe (right positive), move (as reported: forward is negative on most sticks), look. */
	moveX: number;
	moveY: number;
	lookX: number;
	lookY: number;
	/** An axis is bound and the browser has reported it at least once. */
	has: Record<Exclude<AnalogRole, 'throttle'>, boolean>;
}

export const NO_ANALOG: Analog = {
	pitch: 0,
	roll: 0,
	yaw: 0,
	steer: 0,
	drive: 0,
	moveX: 0,
	moveY: 0,
	lookX: 0,
	lookY: 0,
	has: {
		pitch: false,
		roll: false,
		yaw: false,
		steer: false,
		drive: false,
		moveX: false,
		moveY: false,
		lookX: false,
		lookY: false
	}
};

/** Below this, a centred stick reads as centred. */
export const DEADZONE = 0.06;

export function shape(value: number): number {
	const v = Math.max(-1, Math.min(1, value));
	if (Math.abs(v) < DEADZONE) return 0;
	return (Math.sign(v) * (Math.abs(v) - DEADZONE)) / (1 - DEADZONE);
}

/**
 * A throttle lever as forward drive, the way `setThrottle()` reads the ship's: full
 * forward is -1, pulled back is +1 and means stopped. Elite can also run the drive axis
 * full range (back half is reverse); that setting isn't in the binds file. UNVERIFIED.
 */
function lever(value: number): number {
	const v = Math.max(0, Math.min(1, (1 - value) / 2));
	return v < DEADZONE / 2 ? 0 : v;
}

/**
 * The analogue axes bound in `actions`, read from the hub's axis values
 * (`deviceId:axis` → -1..1). `axes` null means the vehicle is frozen: nothing reads.
 *
 * Signs are taken as the browser reports them: pushing the stick forward is negative on
 * most sticks, so it pitches the nose down, and right is positive for roll, yaw and
 * steering. UNVERIFIED against Elite's own conventions and the file's Inverted flag.
 */
export function analogAxes(
	actions: readonly Action[],
	bindings: BindingMap,
	axes: ReadonlyMap<string, number> | null
): Analog {
	if (!axes) return NO_ANALOG;
	const out: Analog = { ...NO_ANALOG, has: { ...NO_ANALOG.has } };
	for (const action of actions) {
		const role = action.analog;
		if (!role || role === 'throttle') continue;
		const key = axisValueKey(bindings[action.id]?.[0]?.input);
		if (!key) continue;
		const value = axes.get(key);
		if (value === undefined) continue;
		out.has[role] = true;
		out[role] = role === 'drive' ? lever(value) : shape(value);
	}
	return out;
}
