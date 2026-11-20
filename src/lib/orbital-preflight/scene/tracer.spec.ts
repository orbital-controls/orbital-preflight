import { describe, expect, it } from 'vitest';
import {
	ELBOW,
	fingerJoints,
	FINGERS,
	GRIP,
	indexJoints,
	INDEX_LENGTHS,
	INDEX_STRAIGHT,
	INDEX_TRIGGER_TIP,
	len,
	onGrip,
	sub,
	twoBone,
	WRIST,
	type V3
} from './tracer.ts';

const close = (a: V3, b: V3, tol = 1e-6) => expect(len(sub(a, b))).toBeLessThan(tol);

describe('the Tracer rig geometry', () => {
	it('puts the wrist and elbow where the block-out does', () => {
		close(onGrip(0), GRIP.top);
		close(WRIST, [-10.35, -3.84, 1.6], 0.02);
		close(ELBOW, [WRIST[0] - 27, WRIST[1] - 7, WRIST[2] + 7]);
	});

	it('wraps the three fingers round the front strap, tips on the left side', () => {
		for (const f of FINGERS) {
			const joints = fingerJoints(f);
			expect(joints).toHaveLength(4);
			// Knuckle on the right side (+z), tip on the left (−z).
			expect(joints[0][2]).toBeGreaterThan(0);
			expect(joints[3][2]).toBeLessThan(0);
		}
	});

	it('the index finger lies straight on the frame and reaches the trigger', () => {
		const straight = indexJoints(0);
		close(straight[0], INDEX_STRAIGHT.base);
		close(straight[3], INDEX_STRAIGHT.tip, 1e-3);
		const pulled = indexJoints(1);
		close(pulled[3], INDEX_TRIGGER_TIP, 1e-3);
	});

	it('never changes a phalanx length along the way', () => {
		for (const t of [0, 0.25, 0.5, 0.75, 1]) {
			const j = indexJoints(t);
			for (let i = 0; i < 3; i++) expect(len(sub(j[i + 1], j[i]))).toBeCloseTo(INDEX_LENGTHS[i], 4);
		}
	});

	it('two-bone IK clamps an unreachable goal to full reach', () => {
		const [, end] = twoBone([0, 0, 0], [10, 0, 0], 2, 1, [0, 1, 0]);
		expect(end[0]).toBeCloseTo(3, 3);
	});
});
