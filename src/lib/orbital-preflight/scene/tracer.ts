/**
 * The Tracer P1 and the Crew Soft right hand: the rig's geometry, from the v0.1 block-out
 * numbers (Pistol3D). Pure: plain `[x, y, z]` tuples, no three.js, so the grip pose and
 * the index finger's path are testable.
 *
 * **Gun frame**, in centimetres: +x toward the muzzle, +y up, +z the gun's right side.
 * The first-person camera is defined in this frame too, so the whole viewmodel is one
 * layer drawn over the world with its own camera (see three/tracer.ts).
 */

import { TRACER_ROUNDS } from '../flight.ts';

export type V3 = readonly [number, number, number];

const DEG = Math.PI / 180;

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => scale(a, 1 / (len(a) || 1));
export const lerp3 = (a: V3, b: V3, t: number): V3 => add(a, scale(sub(b, a), t));
const cross = (a: V3, b: V3): V3 => [
	a[1] * b[2] - a[2] * b[1],
	a[2] * b[0] - a[0] * b[2],
	a[0] * b[1] - a[1] * b[0]
];

/** Rounded boxes: [min, max] per axis. */
export const SLIDE = { x: [-8.2, 9.0], y: [0, 3.2], z: [-1.3, 1.3], radius: 0.75 } as const;
/** How far the slide moves back on fire, and where it locks when empty. */
export const SLIDE_TRAVEL = 1.8;
export const FRAME = { x: [-6.4, 8.6], y: [-1.7, 0.15], z: [-1.15, 1.15] } as const;
export const RAIL_GROOVES = { from: 4.4, to: 8.4, step: 0.9 } as const;

/** Rounds per cartridge, one stripe segment each. */
export const ROUNDS = TRACER_ROUNDS;
export function ammoSegment(i: number) {
	const x = -5.6 + 2.15 * i;
	return { x: [x, x + 1.7] as const, y: [3.12, 3.36] as const, z: [-0.32, 0.32] as const };
}

export const REAR_SIGHT = { x: [-8.0, -7.3], y: [3.1, 3.75], z: 0.65, width: 0.56 } as const;
export const FRONT_SIGHT = { x: [8.2, 8.7], y: [3.1, 3.55], z: [-0.22, 0.22] } as const;
export const BARREL = { x: [3.2, 9.2], y: 1.6, radius: 0.62 } as const;
export const EMITTER = { x: 9.3, y: 1.6, radius: 0.75 } as const;
export const TRIGGER_GUARD: readonly V3[] = [
	[0.6, -1.5, 0],
	[0.9, -2.9, 0],
	[2.2, -3.6, 0],
	[4.0, -3.3, 0],
	[4.9, -2.2, 0],
	[5.0, -1.5, 0]
];
export const TRIGGER_GUARD_RADIUS = 0.32;
export const TRIGGER = { x: [2.2, 2.6], y: [-1.7, -2.85] } as const;

/** The grip: front–back × long × wide, raked back. */
export const GRIP = { size: [3.4, 10, 2.9] as const, rake: 18 * DEG, top: [-3.6, -1.2, 0] as V3 };
/** Down the grip. */
export const GRIP_D: V3 = [-Math.sin(GRIP.rake), -Math.cos(GRIP.rake), 0];
/** Toward the front strap. */
export const GRIP_N: V3 = [Math.cos(GRIP.rake), -Math.sin(GRIP.rake), 0];
export const GRIP_Z: V3 = [0, 0, 1];
export const CARTRIDGE_CAP = [3.5, 0.7, 3.0] as const;

/** A point along the grip axis (`s` cm down from the top) in the gun frame. */
export function onGrip(s: number, n = 0, z = 0): V3 {
	return add(add(add(GRIP.top, scale(GRIP_D, s)), scale(GRIP_N, n)), scale(GRIP_Z, z));
}

/**
 * A point on (or `out` cm outside) the grip's surface, `s` cm down the axis, at angle
 * `deg` round the cross-section: 0° is the front strap, +90° the right side, ±180° the
 * backstrap. The cross-section is taken as an ellipse through the grip's half sizes.
 */
export function aroundGrip(s: number, deg: number, out = 0): V3 {
	const a = deg * DEG;
	const hx = GRIP.size[0] / 2;
	const hz = GRIP.size[2] / 2;
	const r = 1 / Math.hypot(Math.cos(a) / hx, Math.sin(a) / hz) + out;
	return onGrip(s, Math.cos(a) * r, Math.sin(a) * r);
}

/** Middle, ring and pinky: grip-axis distance, joint angles (knuckle → tip) and base radius. */
export const FINGERS = [
	{ name: 'fingerMid', s: 2.4, angles: [62, 18, -38, -92], radius: 0.86 },
	{ name: 'fingerRing', s: 4.3, angles: [62, 18, -38, -88], radius: 0.82 },
	{ name: 'fingerPinky', s: 6.1, angles: [62, 18, -38, -74], radius: 0.72 }
] as const;

/** Each phalanx is thinner than the last. */
export const PHALANX_TAPER = [1, 0.9, 0.8] as const;

/** A wrapped finger's four joints (knuckle, two middle joints, tip), on the grip. */
export function fingerJoints(f: (typeof FINGERS)[number]): V3[] {
	return f.angles.map((deg, i) => aroundGrip(f.s, deg, f.radius * PHALANX_TAPER[Math.min(i, 2)]));
}

/** The index finger, straight along the frame's right side (trigger discipline). */
export const INDEX_STRAIGHT = { base: [0.6, -0.75, 1.85] as V3, tip: [5.4, -0.55, 1.75] as V3 };
/** Where the tip goes on the trigger. */
export const INDEX_TRIGGER_TIP: V3 = [2.7, -1.9, 0.9];
/** Phalanx lengths, base to tip: they add up to the straight finger. */
export const INDEX_LENGTHS = (() => {
	const total = len(sub(INDEX_STRAIGHT.tip, INDEX_STRAIGHT.base));
	return [total * 0.405, total * 0.323, total * 0.272] as const;
})();
export const INDEX_RADIUS = 0.78;
/** The first phalanx's heading on the trigger: forward, dropping and turning in. */
const INDEX_TRIGGER_DIR0: V3 = norm([1.8, -0.15, -0.35]);
/** The middle joint bends away from the frame: up and out. */
const INDEX_BEND_HINT: V3 = norm([0.3, 0.5, 1]);

/**
 * The index finger's four joints for a trigger pose `t` (0 straight on the frame, 1 on
 * the trigger). The first phalanx swings; the other two reach the tip by two-bone IK,
 * bending away from the frame, so the phalanx lengths never change.
 */
export function indexJoints(t: number): V3[] {
	const k = Math.max(0, Math.min(1, t));
	const { base, tip: straightTip } = INDEX_STRAIGHT;
	const [l0, l1, l2] = INDEX_LENGTHS;
	const dir0 = norm(lerp3(norm(sub(straightTip, base)), INDEX_TRIGGER_DIR0, k));
	const j1 = add(base, scale(dir0, l0));
	const goal = lerp3(straightTip, INDEX_TRIGGER_TIP, k);
	const [j2, tip] = twoBone(j1, goal, l1, l2, INDEX_BEND_HINT);
	return [base, j1, j2, tip];
}

/** Two-bone IK from `a` toward `goal`: the middle joint and the end. */
export function twoBone(a: V3, goal: V3, l1: number, l2: number, hint: V3): [V3, V3] {
	const toGoal = sub(goal, a);
	const dist = Math.max(Math.abs(l1 - l2) + 1e-4, Math.min(l1 + l2 - 1e-6, len(toGoal)));
	const axis = norm(toGoal);
	// Distance along the axis to the middle joint's foot, and its height off the axis.
	const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
	const height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
	let up = sub(hint, scale(axis, dot(hint, axis)));
	if (len(up) < 1e-6) up = norm(cross(axis, [0, 0, 1]));
	up = norm(up);
	const mid = add(add(a, scale(axis, along)), scale(up, height));
	const end = add(a, scale(axis, dist));
	return [mid, end];
}

/** The thumb: thenar at the rear-left of the grip, along the frame's left side, pointing at the muzzle. */
export const THUMB: readonly V3[] = [
	[-4.9, -2.3, -1.55],
	[-2.7, -1.05, -2.05],
	[-0.5, -0.5, -2.05],
	[1.5, -0.3, -1.8]
];
export const THUMB_RADIUS = 0.92;

/** The wrist and the elbow, in the gun frame. */
export const WRIST: V3 = add(
	add(add(GRIP.top, scale(GRIP_D, 4.6)), scale(GRIP_N, -5.6)),
	scale(GRIP_Z, 1.6)
);
export const ELBOW: V3 = add(WRIST, [-27, -7, 7]);
/** The sleeve: a frustum from the cuff to the elbow. */
export const SLEEVE = { cuffRadius: 2.9, elbowRadius: 4.4, cuffBack: 0.6 } as const;

/**
 * The first-person camera in the gun frame, and its vertical field of view. The gun sits
 * low on the right, pointing into the screen at the crosshair.
 */
export const VIEW = { eye: [-40, 10, -15] as V3, at: [30, -1, -2] as V3, fov: 46 };
/** Aiming down the sights: the eye on the sight line, behind the rear posts. */
export const VIEW_ADS = { eye: [-26, 3.63, 0] as V3, at: [30, 3.5, 0] as V3, fov: 40 };
