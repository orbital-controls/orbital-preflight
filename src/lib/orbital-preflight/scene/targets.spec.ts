import { describe, expect, it } from 'vitest';
import { act, initialFlight, tick, type FlightState } from '../flight.ts';
import {
	approach,
	flightEvents,
	FULL_YAW_RATE,
	gearPose,
	landed,
	MAX_RING_TILT,
	partTargets,
	ringTilt,
	shipSpeed,
	SPEED_SCALE
} from './targets.ts';

function flight(over: Partial<FlightState> = {}): FlightState {
	return { ...initialFlight(), ...over };
}

describe('partTargets', () => {
	it('gear, scoop and hardpoints deploy their parts', () => {
		const s = act(act(act(initialFlight(), 'gear', ''), 'scoop', ''), 'hp', '');
		const t = partTargets(s);
		expect(t.gear).toBe(1);
		expect(t.bayDoors).toBe(1);
		expect(t.turrets).toBe(1);
		expect(partTargets(initialFlight())).toMatchObject({ gear: 0, bayDoors: 0, turrets: 0 });
	});

	it('the ramp drops only when landed: gear down and throttle at zero', () => {
		expect(partTargets(flight({ gear: true, thr: 0.2 })).ramp).toBe(0);
		expect(partTargets(flight({ gear: false, thr: 0 })).ramp).toBe(0);
		expect(partTargets(flight({ gear: true, thr: 0 })).ramp).toBe(1);
		expect(landed(flight({ gear: true, thr: 0 }))).toBe(true);
	});

	it('ring glow climbs with throttle, goes full gold on boost, and is cut by silent running', () => {
		const idle = partTargets(flight({ thr: 0 }));
		const half = partTargets(flight({ thr: 0.5 }));
		const full = partTargets(flight({ thr: 1 }));
		const boost = partTargets(flight({ thr: 0.5, boostT: 10 }));
		expect(idle.glow).toBeLessThan(half.glow);
		expect(half.glow).toBeLessThan(full.glow);
		expect(boost.glow).toBeGreaterThan(full.glow);
		expect(boost.glowGold).toBe(1);
		expect(half.glowGold).toBeLessThan(1);
		expect(partTargets(flight({ thr: 1, boostT: 10, silent: true })).glow).toBe(0);
	});

	it('silent running dims every emissive and the lights; lights off cuts nose and running lights', () => {
		const silent = partTargets(flight({ silent: true }));
		expect(silent.emissive).toBeLessThan(0.5);
		expect(silent.nose).toBe(0);
		expect(silent.running).toBeLessThan(0.5);
		const dark = partTargets(flight({ lights: false }));
		expect(dark.nose).toBe(0);
		expect(dark.running).toBe(0);
		expect(partTargets(initialFlight())).toMatchObject({ nose: 1, running: 1, emissive: 1 });
	});

	it('heat tints from about halfway and saturates when overheating', () => {
		expect(partTargets(flight({ heat: 0.3 })).heat).toBe(0);
		expect(partTargets(flight({ heat: 0.7 })).heat).toBeGreaterThan(0);
		expect(partTargets(flight({ heat: 1 })).heat).toBe(1);
	});

	it('speed follows the mock flight: boost and supercruise multiply it', () => {
		expect(shipSpeed(flight({ thr: 0.5 }))).toBeCloseTo(0.5 * 4 * SPEED_SCALE);
		expect(shipSpeed(flight({ thr: 0.5, boostT: 3 }))).toBeCloseTo(0.5 * 4 * 2.2 * SPEED_SCALE);
		expect(shipSpeed(flight({ thr: 0.5, sc: true }))).toBeCloseTo(0.5 * 4 * 3 * SPEED_SCALE);
		expect(partTargets(flight({ sc: true })).streak).toBeGreaterThan(partTargets(flight()).streak);
	});

	it('flight assist off lets velocity lag the nose', () => {
		expect(partTargets(flight({ faOff: true })).follow).toBeLessThan(
			partTargets(flight()).follow / 4
		);
	});

	it('roll and vertical thrust bank and trim the ship, signed', () => {
		expect(partTargets(act(initialFlight(), 'rollR', '')).bank).toBeGreaterThan(0);
		expect(partTargets(act(initialFlight(), 'rollL', '')).bank).toBeLessThan(0);
		expect(partTargets(act(initialFlight(), 'up', '')).trim).toBeGreaterThan(0);
		expect(partTargets(act(initialFlight(), 'down', '')).lift).toBeLessThan(0);
		expect(partTargets(initialFlight())).toMatchObject({ bank: 0, trim: 0, lift: 0 });
	});

	it('reduced motion means no camera shake and shorter streaks', () => {
		const s = flight({ boostT: 10 });
		expect(partTargets(s).shake).toBeGreaterThan(0);
		expect(partTargets(s, { reducedMotion: true }).shake).toBe(0);
		expect(partTargets(s, { reducedMotion: true }).streak).toBeLessThan(partTargets(s).streak);
	});

	it('fire, night vision and the camera come through', () => {
		const s = act(act(act(act(initialFlight(), 'hp', ''), 'fire', ''), 'nv', ''), 'camera', '');
		expect(partTargets(s)).toMatchObject({ fire: true, nightVision: true, cockpit: true });
	});
});

describe('ringTilt', () => {
	it('tilts with the yaw rate, signed, up to the limit', () => {
		expect(ringTilt(0)).toBe(0);
		expect(ringTilt(FULL_YAW_RATE / 2)).toBeCloseTo(MAX_RING_TILT / 2);
		expect(ringTilt(-FULL_YAW_RATE * 3)).toBeCloseTo(-MAX_RING_TILT);
	});
});

describe('gearPose', () => {
	it('opens the doors before the legs swing down', () => {
		expect(gearPose(0)).toEqual({ door: 0, leg: 0 });
		expect(gearPose(0.25).door).toBeGreaterThan(0.5);
		expect(gearPose(0.25).leg).toBe(0);
		expect(gearPose(1)).toEqual({ door: 1, leg: 1 });
		expect(gearPose(2)).toEqual({ door: 1, leg: 1 });
	});
});

describe('approach', () => {
	it('eases toward the target the same way at any frame rate', () => {
		let fast = 0;
		for (let i = 0; i < 4; i++) fast = approach(fast, 1, 3, 0.25);
		expect(approach(0, 1, 3, 1)).toBeCloseTo(fast);
		expect(approach(0.5, 0.5, 3, 1)).toBe(0.5);
	});
});

describe('flightEvents', () => {
	it('sees chaff, a heat sink and digital yaw steps', () => {
		const a = flight({ heat: 0.6 });
		expect(flightEvents(a, act(a, 'chaff', '')).chaff).toBe(true);
		expect(flightEvents(a, act(a, 'heatsink', '')).heatSink).toBe(true);
		expect(flightEvents(a, act(a, 'yawR', '')).yaw).toBe(18);
		expect(flightEvents(a, tick(a, 'ship'))).toMatchObject({ chaff: false, heatSink: false });
	});
});
