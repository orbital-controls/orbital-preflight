import { describe, expect, it } from 'vitest';
import {
	castRay,
	PAD,
	ROUTE,
	RAMPS,
	rampHeight,
	rampHinge,
	rampPose,
	SHIP,
	SOLIDS,
	STOP_RADIUS,
	stopAt,
	STOPS,
	TARGETS,
	toLocal,
	toWorld
} from './pad.ts';

describe('Pad 7 Compact', () => {
	it('has seven stops, clockwise from the ramp foot, each with prompts', () => {
		expect(STOPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(STOPS[0].name).toBe('Ramp foot');
		for (const s of STOPS) expect(s.prompts.length).toBeGreaterThan(0);
		expect(STOPS[5].prompts[0]).toMatchObject({ label: 'Use console', effects: ['interact'] });
	});

	it('finds the stop zone a position is in', () => {
		expect(stopAt(-11.3, 0)?.n).toBe(1);
		expect(stopAt(-4.05, -8.7 + STOP_RADIUS * 0.9)?.n).toBe(6);
		expect(stopAt(17.8 + 1.5, -6.8)?.n).toBe(5);
		expect(stopAt(0, 0)).toBeNull();
		expect(stopAt(-4.05, -8.7 + STOP_RADIUS + 0.1)).toBeNull();
	});

	it('puts every stop on open deck, clear of the solids', () => {
		for (const s of STOPS) {
			for (const solid of SOLIDS) {
				const [lx, lz] = toLocal(solid, s.at[0], s.at[1]);
				const inside = Math.abs(lx) < solid.hx && Math.abs(lz) < solid.hz;
				expect(inside, `${s.name} inside ${solid.id}`).toBe(false);
			}
		}
	});

	it('round-trips a solid frame, the barrier included', () => {
		const barrier = SOLIDS.find((s) => s.id === 'barrier')!;
		const [x, z] = toWorld(barrier, barrier.hx, 0);
		expect(x).toBeCloseTo(21.9, 4);
		expect(z).toBeCloseTo(-3.2, 4);
		const [lx, lz] = toLocal(barrier, 18.6, 4.0);
		expect(lx).toBeCloseTo(-barrier.hx, 4);
		expect(lz).toBeCloseTo(0, 4);
	});

	it('drops the ship ramp from its hinge to the deck near x −9.6', () => {
		const ramp = RAMPS[0];
		expect(rampHeight(ramp, SHIP.rampFootX, 0)).toBeCloseTo(0);
		expect(rampHeight(ramp, rampHinge().x, 0)).toBeCloseTo(rampHinge().y);
		expect(rampHeight(ramp, 0, 0)).toBeNull();
		const pose = rampPose();
		// Past horizontal, aft and down; stretched to reach.
		expect(pose.angle).toBeGreaterThan(Math.PI / 2);
		expect(pose.stretch).toBeGreaterThan(1);
	});

	it('runs the route through every stop in order, round the outside of the pad', () => {
		const at = STOPS.map((st) => ROUTE.findIndex((p) => p === st.at));
		expect(at.every((i, k) => i >= 0 && (k === 0 || i > at[k - 1]))).toBe(true);
		// Between stops 2 and 3 it passes south of the pad, not across it.
		const south = ROUTE.slice(at[1] + 1, at[2]);
		for (const [x, z] of south) expect(Math.hypot(x, z)).toBeGreaterThan(PAD.radius);
	});

	it('casts a round from the firing line into the middle ring', () => {
		const eye = [17.8, 1.7, -6.8] as const;
		const ring = TARGETS.rings[1];
		const d = [ring.x - eye[0], ring.y - eye[1], TARGETS.z - eye[2]] as const;
		const n = Math.hypot(...d);
		const hit = castRay(eye, [d[0] / n, d[1] / n, d[2] / n]);
		expect(hit.ring).toBe(1);
		expect(hit.what).toBe('ring');
	});

	it('a round that misses the rings stops on the panel or the wall', () => {
		const hit = castRay([17.8, 1.7, -6.8], [0, 0.7071, -0.7071]);
		expect(hit.ring).toBeNull();
		expect(['wall', 'ceiling']).toContain(hit.what);
		const crate = castRay([-14, 0.5, 7.8], [-1, 0, 0]);
		expect(crate.what).toBe('crateA');
	});
});
