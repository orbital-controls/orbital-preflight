import { describe, expect, it } from 'vitest';
import { act, initialFlight, tick, type FlightState } from '../flight.ts';
import { NO_ANALOG, type Analog } from './analog.ts';
import {
	JET_GLOW,
	LOW_FUEL,
	MAX_SPEED,
	MAX_STEER,
	srvTargets,
	TAIL,
	TURRET,
	turretPitch,
	turretPose,
	wheelYaw
} from './srv.ts';

const flight = (patch: Partial<FlightState> = {}): FlightState => ({
	...initialFlight(),
	...patch
});
const analog = (patch: Partial<Analog>): Analog => ({
	...NO_ANALOG,
	...patch,
	has: { ...NO_ANALOG.has, ...patch.has }
});

describe('srvTargets', () => {
	it('steers the front wheels about 20° each way from the steer binds', () => {
		expect(wheelYaw(flight())).toBe(0);
		const left = act(flight(), 'steerL', 'Steer left');
		const right = act(flight(), 'steerR', 'Steer right');
		expect(srvTargets(left).steer).toBeCloseTo(MAX_STEER);
		expect(srvTargets(right).steer).toBeCloseTo(-MAX_STEER);
		expect((MAX_STEER * 180) / Math.PI).toBe(20);
		// The step runs out with the steer timer.
		let s = left;
		for (let i = 0; i < 10; i++) s = tick(s, 'srv');
		expect(srvTargets(s).steer).toBe(0);
	});

	it('a bound steering axis drives the wheels directly and wins over the binds', () => {
		const s = act(flight(), 'steerL', 'Steer left');
		expect(
			srvTargets(s, analog({ steer: 0.5, has: { steer: true } as Analog['has'] })).steer
		).toBeCloseTo(-0.5 * MAX_STEER);
		// Centred, the digital step still works.
		expect(
			srvTargets(s, analog({ steer: 0, has: { steer: true } as Analog['has'] })).steer
		).toBeCloseTo(MAX_STEER);
	});

	it('follows the mock flight speed, or a bound drive axis when it is off its rest', () => {
		expect(srvTargets(flight({ sSpd: 12 })).speed).toBe(12);
		const a = analog({ drive: 0.5, has: { drive: true } as Analog['has'] });
		expect(srvTargets(flight({ sSpd: 12 }), a).speed).toBe(MAX_SPEED / 2);
		const rest = analog({ drive: 0, has: { drive: true } as Analog['has'] });
		expect(srvTargets(flight({ sSpd: -6 }), rest).speed).toBe(-6);
	});

	it('the hop jets idle dim violet and go bright with a plume when they fire', () => {
		const idle = srvTargets(flight());
		expect(idle).toMatchObject({ jets: false, jetGlow: JET_GLOW.idle, plume: 0, thrust: 0 });
		const fired = srvTargets(act(flight(), 'jets', 'Vertical thrusters'));
		expect(fired.jets).toBe(true);
		expect(fired.jetGlow).toBe(JET_GLOW.firing);
		expect(fired.plume).toBe(1);
		expect(fired.thrust).toBeGreaterThan(0);
		let s = act(flight(), 'jets', 'Vertical thrusters');
		for (let i = 0; i < 12; i++) s = tick(s, 'srv');
		expect(srvTargets(s).plume).toBeLessThan(1);
		expect(srvTargets(s).plume).toBeGreaterThan(0);
	});

	it('headlights light the lamps; the tail strip brightens on brake and reverse', () => {
		expect(srvTargets(flight()).headlights).toBe(1);
		const dark = srvTargets(act(flight(), 'sLights', 'Headlights'));
		expect(dark.headlights).toBe(0);
		expect(dark.lamps).toBeLessThan(srvTargets(flight()).lamps);
		expect(srvTargets(flight({ sThr: 0.5, sSpd: 10 })).tail).toBe(TAIL.running);
		const braking = srvTargets(flight({ sThr: 0, sSpd: 10 }));
		expect(braking).toMatchObject({ braking: true, tail: TAIL.bright });
		const reversing = srvTargets(flight({ sThr: -0.25, sSpd: -2 }));
		expect(reversing).toMatchObject({ reversing: true, tail: TAIL.bright });
	});

	it('drive assist holds the grip; off, the SRV slides', () => {
		const on = srvTargets(flight());
		const off = srvTargets(act(flight(), 'da', 'Drive assist'));
		expect(off.grip).toBeLessThan(on.grip / 4);
	});

	it('low fuel pulses the spare cell; reduced motion calms dust and shake', () => {
		expect(srvTargets(flight({ fuel: LOW_FUEL + 0.01 })).cellPulse).toBe(false);
		expect(srvTargets(flight({ fuel: LOW_FUEL - 0.01 })).cellPulse).toBe(true);
		const jets = act(flight(), 'jets', 'Vertical thrusters');
		expect(srvTargets(jets).shake).toBeGreaterThan(0);
		const calm = srvTargets(jets, undefined, { reducedMotion: true });
		expect(calm.shake).toBe(0);
		expect(calm.dust).toBeLessThan(1);
	});

	it('the camera toggle picks the driver seat', () => {
		expect(srvTargets(flight()).driver).toBe(false);
		expect(srvTargets(act(flight(), 'camera', 'Toggle camera')).driver).toBe(true);
	});

	it('turret mode raises the turret; fire only counts in turret mode', () => {
		expect(srvTargets(flight())).toMatchObject({ turret: false, fire: false, fire2: false });
		const up = act(flight(), 'turret', 'Turret mode');
		expect(srvTargets(up).turret).toBe(true);
		expect(srvTargets(act(up, 'tFire', 'Primary fire')).fire).toBe(true);
		expect(srvTargets(act(up, 'tFire2', 'Secondary fire')).fire2).toBe(true);
		// Out of turret mode the mock flight refuses to fire, so nothing reaches the scene.
		expect(srvTargets(act(flight(), 'tFire', 'Primary fire')).fire).toBe(false);
	});
});

describe('the roof turret', () => {
	it('stows facing aft, rises first, then swings to the aim', () => {
		expect(turretPose(0, 0.3, 0.1)).toEqual({ lift: 0, yaw: TURRET.stowedYaw, pitch: 0 });
		const rising = turretPose(0.3, 0.3, 0.1);
		expect(rising.lift).toBeGreaterThan(0);
		expect(rising.yaw).toBe(TURRET.stowedYaw);
		const up = turretPose(1, 0.3, 0.1);
		expect(up.lift).toBeCloseTo(TURRET.lift);
		expect(up.yaw).toBeCloseTo(0.3);
		expect(up.pitch).toBeCloseTo(0.1);
	});

	it('swings the short way round', () => {
		// Aft-left is closer to the stowed yaw going left than going through the nose.
		const yaw = turretPose(0.8, Math.PI - 0.5, 0).yaw;
		expect(yaw).toBeGreaterThan(Math.PI - 0.5);
		expect(yaw).toBeLessThanOrEqual(Math.PI);
	});

	it('keeps the barrel off the cabin glass ahead and the rack behind', () => {
		expect(turretPitch(0, -0.5)).toBeCloseTo(TURRET.minPitchFront);
		expect(turretPitch(Math.PI, -0.5)).toBeCloseTo(TURRET.minPitchRear);
		expect(turretPitch(0, 2)).toBeCloseTo(TURRET.maxPitch);
		expect(turretPitch(0.2, 0.1)).toBe(0.1);
	});
});
