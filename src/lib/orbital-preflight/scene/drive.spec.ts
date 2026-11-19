import { describe, expect, it } from 'vitest';
import {
	compressions,
	restChassis,
	stepChassis,
	suspensionTargets,
	SUSPENSION,
	WHEELBASE,
	WHEELS,
	type DriveInput,
	type Ground
} from './drive.ts';
import { JET_THRUST } from './srv.ts';

const flat: Ground = () => 0;
const cruise = (patch: Partial<DriveInput> = {}): DriveInput => ({
	speed: 0,
	follow: 8,
	steer: 0,
	grip: 9,
	thrust: 0,
	...patch
});
const run = (c: ReturnType<typeof restChassis>, input: DriveInput, ground: Ground, s: number) => {
	for (let t = 0; t < s; t += 1 / 60) stepChassis(c, input, ground, 1 / 60);
	return c;
};

describe('suspension targets', () => {
	it('sit at rest on flat ground', () => {
		const c = restChassis(flat);
		expect(suspensionTargets(c, flat).map((t) => Math.abs(t) < 1e-9)).toEqual([
			true,
			true,
			true,
			true
		]);
	});

	it('push a wheel up over a bump, clamped at the bump stop, and droop into a dip', () => {
		const c = restChassis(flat);
		const fl = WHEELS[0];
		const under =
			(h: number): Ground =>
			(x, z) =>
				Math.hypot(x - fl.x, z - fl.z) < 0.3 ? h : 0;
		expect(suspensionTargets(c, under(0.1))[0]).toBeCloseTo(0.1);
		expect(suspensionTargets(c, under(0.1))[3]).toBeCloseTo(0);
		expect(suspensionTargets(c, under(0.5))[0]).toBe(SUSPENSION.bump);
		expect(suspensionTargets(c, under(-0.5))[0]).toBe(-SUSPENSION.droop);
	});

	it('follow the chassis: nose up lifts the front hubs, so the front wheels droop', () => {
		const c = restChassis(flat);
		c.pitch = 0.05;
		const comp = compressions(c, flat);
		expect(comp[0]).toBeLessThan(0);
		expect(comp[2]).toBeGreaterThan(0);
	});
});

describe('the drive model', () => {
	it('settles at rest and stays put', () => {
		const c = run(restChassis(flat), cruise(), flat, 3);
		expect(Math.abs(c.y)).toBeLessThan(0.01);
		expect(Math.hypot(c.x, c.z)).toBeLessThan(1e-6);
		expect(c.contact).toEqual([true, true, true, true]);
	});

	it('drives forward (-Z), and steering left turns left at the bicycle-model rate', () => {
		const c = run(restChassis(flat), cruise({ speed: 10 }), flat, 3);
		expect(c.speed).toBeCloseTo(10, 0);
		expect(c.z).toBeLessThan(-15);
		expect(Math.abs(c.x)).toBeLessThan(1e-6);
		expect(c.spin).toBeLessThan(0);
		const before = c.heading;
		run(c, cruise({ speed: 10, steer: 0.2 }), flat, 1);
		expect(c.heading).toBeGreaterThan(before);
		expect(c.heading - before).toBeLessThan((10 * Math.tan(0.2)) / WHEELBASE + 0.01);
	});

	it('slides with drive assist off: more sideways slip in the same turn', () => {
		const turn = (grip: number) => {
			const c = run(restChassis(flat), cruise({ speed: 20, grip }), flat, 2);
			run(c, cruise({ speed: 20, grip, steer: 0.3 }), flat, 0.6);
			return Math.abs(c.slip);
		};
		expect(turn(1.1)).toBeGreaterThan(turn(9) * 3);
	});

	it('the jets give a short hop, and it lands again', () => {
		const c = run(restChassis(flat), cruise(), flat, 1);
		run(c, cruise({ thrust: JET_THRUST }), flat, 0.8);
		expect(c.y).toBeGreaterThan(0.4);
		expect(c.contact.some((t) => t)).toBe(false);
		run(c, cruise(), flat, 4);
		expect(Math.abs(c.y)).toBeLessThan(0.05);
		expect(c.contact).toEqual([true, true, true, true]);
	});

	it('the front wheels ride over a step and the chassis pitches with it', () => {
		const step: Ground = (_x, z) => (z < -3 ? 0.15 : 0);
		const c = run(restChassis(flat), cruise({ speed: 4 }), step, 0.2);
		let maxPitch = 0;
		for (let t = 0; t < 1; t += 1 / 60) {
			stepChassis(c, cruise({ speed: 4 }), step, 1 / 60);
			maxPitch = Math.max(maxPitch, c.pitch);
		}
		expect(maxPitch).toBeGreaterThan(0.01);
	});
});
