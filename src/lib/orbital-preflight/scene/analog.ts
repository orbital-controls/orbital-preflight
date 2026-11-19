import type { Action, BindingMap } from '../types.ts';

/** Bound stick axes as the 3D scene reads them, each -1..1, with whether one is bound. */
export interface Analog {
	pitch: number;
	roll: number;
	yaw: number;
	/** An axis is bound and the browser has reported it at least once. */
	has: { pitch: boolean; roll: boolean; yaw: boolean };
}

export const NO_ANALOG: Analog = {
	pitch: 0,
	roll: 0,
	yaw: 0,
	has: { pitch: false, roll: false, yaw: false }
};

/** Below this, a centred stick reads as centred. */
export const DEADZONE = 0.06;

function shape(value: number): number {
	const v = Math.max(-1, Math.min(1, value));
	if (Math.abs(v) < DEADZONE) return 0;
	return (Math.sign(v) * (Math.abs(v) - DEADZONE)) / (1 - DEADZONE);
}

/**
 * The pitch, roll and yaw axes bound in `actions`, read from the hub's axis values
 * (`deviceId:axis` → -1..1). `axes` null means the ship is frozen: nothing reads.
 *
 * Signs are taken as the browser reports them: pushing the stick forward is negative on
 * most sticks, so it pitches the nose down, and right is positive for roll and yaw.
 * UNVERIFIED against Elite's own conventions and the file's Inverted flag.
 */
export function analogAxes(
	actions: readonly Action[],
	bindings: BindingMap,
	axes: ReadonlyMap<string, number> | null
): Analog {
	if (!axes) return NO_ANALOG;
	const out = { pitch: 0, roll: 0, yaw: 0, has: { pitch: false, roll: false, yaw: false } };
	for (const action of actions) {
		const role = action.analog;
		if (role !== 'pitch' && role !== 'roll' && role !== 'yaw') continue;
		const input = bindings[action.id]?.[0]?.input;
		if (input?.kind !== 'axis' || input.half) continue;
		const value = axes.get(`${input.deviceId}:${input.axis}`);
		if (value === undefined) continue;
		out.has[role] = true;
		out[role] = shape(value);
	}
	return out;
}
