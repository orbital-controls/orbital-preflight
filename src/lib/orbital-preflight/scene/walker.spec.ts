import { describe, expect, it } from 'vitest';
import { rampHinge, SOLIDS, STOPS } from './pad.ts';
import {
	IDLE_INPUT,
	spawnWalker,
	stepWalker,
	WALK,
	type Walker,
	type WalkInput
} from './walker.ts';

const run = (w: Walker, input: Partial<WalkInput>, seconds: number, first?: Partial<WalkInput>) => {
	let s = w;
	const dt = 1 / 60;
	for (let i = 0; i < seconds * 60; i++)
		s = stepWalker(s, { ...IDLE_INPUT, ...input, ...(i === 0 ? first : {}) }, dt);
	return s;
};

describe('the on-foot walker', () => {
	it('walks forward at walking pace, faster sprinting, slower crouched', () => {
		const start = spawnWalker(0, 10, 0);
		const walk = run(start, { forward: 1 }, 1);
		expect(walk.z).toBeLessThan(10 - 2.5);
		const sprint = run(start, { forward: 1, sprint: true }, 1);
		expect(sprint.z).toBeLessThan(walk.z - 1.5);
		const crouch = run(start, { forward: 1, crouch: true }, 1);
		expect(crouch.z).toBeGreaterThan(walk.z + 1);
	});

	it('turns with the look deltas and clamps pitch', () => {
		const w = stepWalker(
			spawnWalker(0, 10, 0),
			{ ...IDLE_INPUT, yaw: Math.PI / 2, pitch: 5 },
			1 / 60
		);
		expect(w.yaw).toBeCloseTo(Math.PI / 2);
		expect(w.pitch).toBe(WALK.pitchLimit);
		// Facing west now: forward moves −x.
		const moved = run(w, { forward: 1 }, 0.5);
		expect(moved.x).toBeLessThan(-0.5);
	});

	it('stops at the bay walls', () => {
		const w = run(spawnWalker(0, -11, 0), { forward: 1 }, 3);
		expect(w.z).toBeCloseTo(-13 + WALK.radius, 3);
	});

	it('is blocked by a crate taller than a step', () => {
		// crateC: 0.9 m footprint, 1.8 m tall, at (−16.9, 5.1). Walk west into it.
		const w = run(spawnWalker(-14.5, 5.1, Math.PI / 2), { forward: 1 }, 2);
		expect(w.x).toBeGreaterThan(-16.9 + 0.45 + WALK.radius - 0.02);
	});

	it('walks up the ship ramp but not into the ship', () => {
		const w = run(spawnWalker(-11.3, 0, -Math.PI / 2), { forward: 1 }, 4);
		expect(w.y).toBeGreaterThan(0.75);
		expect(w.x).toBeLessThan(rampHinge().x);
	});

	it('vaults the 1 m cargo barrier with a jump, and not without', () => {
		const from = STOPS[3].at;
		// Face east, toward the barrier.
		const blocked = run(spawnWalker(from[0], from[1], -Math.PI / 2), { forward: 1 }, 2);
		expect(blocked.x).toBeLessThan(20.3);
		let w = run(spawnWalker(from[0], from[1], -Math.PI / 2), { forward: 1 }, 0.35);
		w = run(w, { forward: 1 }, 2, { jump: true });
		expect(w.x).toBeGreaterThan(21);
		expect(w.y).toBeCloseTo(0, 3);
	});

	it('bumps into a ring duct standing, and passes under it crouched', () => {
		const ring = SOLIDS.find((s) => s.id === 'shipRingR')!;
		// Walk east along the hull's side, under the starboard ring.
		const from = spawnWalker(ring.cx - ring.hx - 2, ring.cz + 0.4, -Math.PI / 2);
		const standing = run(from, { forward: 1 }, 2);
		expect(standing.x).toBeLessThan(ring.cx - ring.hx);
		const crouched = run(from, { forward: 1, crouch: true }, 4);
		expect(crouched.x).toBeGreaterThan(ring.cx + ring.hx);
	});

	it('crouches smoothly', () => {
		const w = run(spawnWalker(0, 10, 0), { crouch: true }, 1);
		expect(w.crouch).toBeGreaterThan(0.99);
	});
});
