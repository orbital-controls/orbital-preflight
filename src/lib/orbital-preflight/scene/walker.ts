import { BAY, RAMPS, rampHeight, SOLIDS, toLocal, toWorld, type Ramp, type Solid } from './pad.ts';

/**
 * On foot: a kinematic first-person walker. A capsule (radius and height below) slides
 * against simple boxes and the bay's walls, steps up anything low, walks up ramps, falls
 * and jumps. No physics engine. Pure: `stepWalker()` returns a new state.
 *
 * Yaw follows three.js: 0 looks north (−Z), positive turns left (toward −X).
 */

export const WALK = {
	radius: 0.35,
	height: 1.8,
	eye: 1.7,
	crouchEye: 1.05,
	crouchHeight: 1.15,
	/** Ledges up to this high are stepped onto; anything higher is a wall. */
	step: 0.36,
	/** m/s */
	walk: 3.2,
	sprint: 6.0,
	crouchSpeed: 1.6,
	/** How fast speed follows the input (1/s). */
	accel: 12,
	gravity: 18,
	/** Take-off speed: a 0.87 m hop, enough to vault the 1 m barrier. */
	jump: 5.6,
	/** Look limit up and down, radians. */
	pitchLimit: 1.45,
	/** Crouch ease (1/s). */
	ease: 10
} as const;

export interface Walker {
	x: number;
	z: number;
	/** Feet height. */
	y: number;
	vx: number;
	vz: number;
	vy: number;
	yaw: number;
	pitch: number;
	grounded: boolean;
	/** 0 standing … 1 crouched, eased. */
	crouch: number;
}

export interface WalkInput {
	/** −1 back … 1 forward. */
	forward: number;
	/** −1 left … 1 right. */
	strafe: number;
	sprint: boolean;
	crouch: boolean;
	/** True on the frame a jump starts. */
	jump: boolean;
	/** Look deltas this frame, radians: yaw (left positive) and pitch (up positive). */
	yaw: number;
	pitch: number;
}

export const IDLE_INPUT: WalkInput = {
	forward: 0,
	strafe: 0,
	sprint: false,
	crouch: false,
	jump: false,
	yaw: 0,
	pitch: 0
};

export function spawnWalker(x: number, z: number, yaw: number): Walker {
	return { x, z, y: 0, vx: 0, vz: 0, vy: 0, yaw, pitch: 0, grounded: true, crouch: 0 };
}

export interface World {
	solids: readonly Solid[];
	ramps: readonly Ramp[];
	bay: { x: readonly [number, number]; z: readonly [number, number] };
}

export const PAD7_WORLD: World = { solids: SOLIDS, ramps: RAMPS, bay: BAY };

/** The eye height above the feet, for the crouch amount. */
export function eyeHeight(w: Walker): number {
	return WALK.eye + (WALK.crouchEye - WALK.eye) * w.crouch;
}

/** Horizontal speed, m/s. */
export function speedOf(w: Walker): number {
	return Math.hypot(w.vx, w.vz);
}

/** The highest surface under a circle at (x, z) that the feet at `feet` can stand on. */
export function groundAt(world: World, x: number, z: number, feet: number): number {
	let g = 0;
	const reach = feet + WALK.step;
	for (const s of world.solids) {
		if (s.y1 > reach || s.y1 <= g) continue;
		if (circleHitsSolid(s, x, z, WALK.radius * 0.6)) g = s.y1;
	}
	for (const r of world.ramps) {
		const h = rampHeight(r, x, z);
		if (h !== null && h <= reach && h > g) g = h;
	}
	return g;
}

function circleHitsSolid(s: Solid, x: number, z: number, r: number): boolean {
	const [lx, lz] = toLocal(s, x, z);
	const cx = Math.max(-s.hx, Math.min(s.hx, lx));
	const cz = Math.max(-s.hz, Math.min(s.hz, lz));
	return (lx - cx) ** 2 + (lz - cz) ** 2 < r * r;
}

/** Pushes a circle out of a solid; returns the corrected (x, z) or null if it didn't touch. */
function pushOut(s: Solid, x: number, z: number, r: number): [number, number] | null {
	const [lx, lz] = toLocal(s, x, z);
	const cx = Math.max(-s.hx, Math.min(s.hx, lx));
	const cz = Math.max(-s.hz, Math.min(s.hz, lz));
	const dx = lx - cx;
	const dz = lz - cz;
	const d2 = dx * dx + dz * dz;
	if (d2 >= r * r) return null;
	if (d2 > 1e-12) {
		const d = Math.sqrt(d2);
		return toWorld(s, cx + (dx / d) * r, cz + (dz / d) * r);
	}
	// The centre is inside: out through the nearest face.
	const ex = s.hx - Math.abs(lx);
	const ez = s.hz - Math.abs(lz);
	if (ex < ez) return toWorld(s, Math.sign(lx || 1) * (s.hx + r), lz);
	return toWorld(s, lx, Math.sign(lz || 1) * (s.hz + r));
}

/** A ramp too high to step onto from `feet` blocks like a wall. */
function rampBlocks(world: World, x: number, z: number, feet: number): boolean {
	for (const r of world.ramps) {
		const h = rampHeight(r, x, z);
		if (h !== null && h > feet + WALK.step) return true;
	}
	return false;
}

/** One step of `dt` seconds. */
export function stepWalker(
	w: Walker,
	input: WalkInput,
	dt: number,
	world: World = PAD7_WORLD
): Walker {
	const yaw = w.yaw + input.yaw;
	const pitch = Math.max(-WALK.pitchLimit, Math.min(WALK.pitchLimit, w.pitch + input.pitch));
	const ease = 1 - Math.exp(-WALK.ease * dt);
	const crouch = w.crouch + ((input.crouch ? 1 : 0) - w.crouch) * ease;

	// Wanted velocity on the ground plane, from the input in the look frame.
	let f = Math.max(-1, Math.min(1, input.forward));
	let s = Math.max(-1, Math.min(1, input.strafe));
	const mag = Math.hypot(f, s);
	if (mag > 1) {
		f /= mag;
		s /= mag;
	}
	const sprinting = input.sprint && f > 0.1 && !input.crouch;
	const top = input.crouch ? WALK.crouchSpeed : sprinting ? WALK.sprint : WALK.walk;
	// Forward is −Z at yaw 0; right is +X.
	const sin = Math.sin(yaw);
	const cos = Math.cos(yaw);
	const wantX = (-sin * f + cos * s) * top;
	const wantZ = (-cos * f - sin * s) * top;
	const k = 1 - Math.exp(-(w.grounded ? WALK.accel : WALK.accel * 0.25) * dt);
	const vx = w.vx + (wantX - w.vx) * k;
	const vz = w.vz + (wantZ - w.vz) * k;

	// Vertical: jump from the ground, fall otherwise.
	let vy = w.vy;
	let grounded = w.grounded;
	if (input.jump && grounded) {
		vy = WALK.jump;
		grounded = false;
	}
	vy -= WALK.gravity * dt;
	let y = w.y + vy * dt;

	// Horizontal move, an axis at a time so walls slide.
	let x = w.x;
	let z = w.z;
	const height = input.crouch ? WALK.crouchHeight : WALK.height;
	const feetForBlock = Math.max(w.y, y);
	const tryMove = (nx: number, nz: number): boolean => {
		if (rampBlocks(world, nx, nz, feetForBlock)) return false;
		x = nx;
		z = nz;
		return true;
	};
	tryMove(x + vx * dt, z);
	tryMove(x, z + vz * dt);
	for (let pass = 0; pass < 2; pass++) {
		for (const solid of world.solids) {
			// Low enough to step on, or entirely above the head: not a wall.
			if (solid.y1 <= feetForBlock + WALK.step || solid.y0 >= feetForBlock + height) continue;
			const out = pushOut(solid, x, z, WALK.radius);
			if (out) [x, z] = out;
		}
	}
	x = Math.max(world.bay.x[0] + WALK.radius, Math.min(world.bay.x[1] - WALK.radius, x));
	z = Math.max(world.bay.z[0] + WALK.radius, Math.min(world.bay.z[1] - WALK.radius, z));

	// Land, stand, or stick to the ground walking down a slope.
	const ground = groundAt(world, x, z, Math.max(w.y, y));
	if (y <= ground) {
		y = ground;
		vy = 0;
		grounded = true;
	} else if (grounded && vy <= 0 && y - ground <= WALK.step) {
		y = ground;
		vy = 0;
	} else grounded = false;

	return {
		x,
		z,
		y,
		// What actually happened: a wall soaks up the speed into it.
		vx: dt > 0 ? Math.max(-Math.abs(vx), Math.min(Math.abs(vx), (x - w.x) / dt)) : vx,
		vz: dt > 0 ? Math.max(-Math.abs(vz), Math.min(Math.abs(vz), (z - w.z) / dt)) : vz,
		vy,
		yaw,
		pitch,
		grounded,
		crouch
	};
}
